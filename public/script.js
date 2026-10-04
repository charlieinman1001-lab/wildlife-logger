function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation not supported'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy   // in metres
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}


async function shrinkImage(file, maxSize = 1024, targetBytes = 120 * 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.7;
  let blob;
  do {
    blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    quality -= 0.1;
  } while (blob.size > targetBytes && quality > 0.3);

  return blob;
}




async function fetchAllSightings(){
    const res = await fetch('/api/sightings');
    return await res.json();

}






if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/serviceWorker.js');
}







let inspectSighting = false;


const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const speciesInput = document.getElementById('speciesInput');
const loaderElement = document.getElementById('loader');



async function deleteSighting(id){
    const res = await fetch(`/api/sightings/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        throw new Error('delete failed');
    }

    loadSightings();

}




async function setSighting(formData){

    try{  
        const response = await fetch('/api/sightings', {
        method: 'POST',
        body: formData
        });

        
        if(!response.ok){
            loaderElement.classList.remove("loader");
            throw new Error("response not ok")
        }
        else{
            console.log("new species logged")
            loadSightings()

        }
    }catch(error){
        throw error
    }
}


const map = L.map('map').setView([51.89, 0.9067], 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
maxZoom: 20,
attribution: '&copy; OpenStreetMap contributors'
}).addTo(map)

const markers = L.layerGroup().addTo(map);  //markers layer group




async function loadSightings(){ 
    const allSightings = await fetchAllSightings();

    const sightingsList = document.getElementById("sightingsList");
    sightingsList.innerHTML = "";


    markers.clearLayers();
    allSightings.forEach(element => {
        L.marker([element.latitude, element.longitude]).addTo(markers).bindPopup(`<p>${element.species}</p> <img style="width: 175px; border-radius: 5px;"src="/uploads/${element.image}">`)
        
        const li = document.createElement("li");
        li.className = "sighting";


        const thumbnail = document.createElement("img")  ////add thumbnail to each sighting
        Object.assign(thumbnail, {
            src: `/uploads/${element.image}`,
            className: 'sightingThumbnail',
            alt: `${element.species} thumbnail`
        });
        li.appendChild(thumbnail);

        const sightingLabel = document.createElement("p");  //add label for sighting
        sightingLabel.textContent = `${element.species} (${element.kind})`;
        sightingLabel.className = "sightingLabel";
        li.appendChild(sightingLabel);
    

        const deleteSightingButton = document.createElement("button"); //add delete button
        Object.assign(deleteSightingButton, {
            className: "deleteSightingButton",
            textContent: "×"
        })
        li.appendChild(deleteSightingButton);


        sightingsList.appendChild(li);



        thumbnail.addEventListener('click', (event) =>{ //create enlarged sighting view
            if(!inspectSighting){
                console.log("sighting clicked")

                document.getElementById("backdrop").className = "backdrop";

                inspectSighting = true;
                enlargedSighting = document.createElement('div');
                enlargedSighting.className = "enlargedSighting";

                const enlargedThumbnail = document.createElement("img");  ////add thumbnail to enlarged sighting
                Object.assign(enlargedThumbnail, {
                    src: `/uploads/${element.image}`,
                    className: 'enlargedThumbnail',
                    alt: `${element.species} thumbnail`
                });
                enlargedSighting.appendChild(enlargedThumbnail);

                const enlargedCaption = document.createElement("h2"); ////add caption to enlarged sighting
                Object.assign(enlargedCaption, {
                    className: "enlargedSightingCaption",
                    textContent: `${element.species} (${element.kind})`
                })
                enlargedSighting.appendChild(enlargedCaption);


                const backButton = document.createElement("btn"); //create button to exit enlarged sighting
                Object.assign(backButton, {
                    className: "enlargedSightingBackButton",
                    onclick: function () {
                        enlargedSighting.remove();
                        document.getElementById("backdrop").className = "";
                        inspectSighting = false;
                    },
                    textContent: "exit ×"
                })
                enlargedSighting.appendChild(backButton);


                



                document.body.appendChild(enlargedSighting);
            }
        })




        deleteSightingButton.addEventListener('click', () => {   
            if (confirm('Delete this sighting?')) deleteSighting(element.id);
        });


    });    

    
}








imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];

  if (imagePreview.src) URL.revokeObjectURL(imagePreview.src);   // free the old one

  if (file) {
    imagePreview.src = URL.createObjectURL(file);
    imagePreview.hidden = false;
  } else {
    imagePreview.removeAttribute('src');
    imagePreview.hidden = true;
  }
});



document.getElementById('speciesForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    loaderElement.classList.add("loader");

    const formData = new FormData(event.target);


    const image = formData.get("imageInput");
    const blob = await shrinkImage(image);
    formData.set("imageInput", blob, "photo.jpeg");

    event.target.reset();
    imagePreview.hidden = true;
    imagePreview.removeAttribute('src');


    let location = {};
    try {
        location = await getLocation();
    } catch (err) {
        console.log('No location:', err.message);   // denied, timed out, etc.
    }

    formData.append('latitude', location.latitude ?? '');
    formData.append('longitude', location.longitude ?? '');
    formData.append('date', new Date().toISOString());

    await setSighting(formData);


    loadSightings();
    loaderElement.classList.remove("loader");
})










loadSightings();
