const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const multer = require('multer');
const fs = require('fs');


const app = express();
app.use(express.static('public')); //lets backend serve frontend
app.use(express.json()); // lets backend read JSON sent from the browser





const uploadDir = path.join(__dirname, 'uploads');   ////creates the folder at the given directory
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname))
  }),
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

app.use('/uploads', express.static(uploadDir));







const db = new Database(path.join(__dirname, 'sightings.db')) //open (or create if not already) the database 
db.pragma('journal_mode = WAL') //set mode to write-ahead logging instead of degault rollback journal




db.exec(`
    CREATE TABLE IF NOT EXISTS sightings(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    species TEXT NOT NULL,
    kind TEXT NOT NULL,
    date TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    image TEXT
    )
`);

const enterSighting = db.prepare(`
    INSERT INTO sightings (species, kind, date, latitude, longitude, image)
    VALUES (?, ?, ?, ?, ?, ?)`);

const fetchAllSightings = db.prepare(`
    SELECT * FROM sightings ORDER BY date DESC`);

const getSighting = db.prepare(`SELECT * FROM sightings WHERE id = ?`);
const removeSighting = db.prepare('DELETE FROM sightings WHERE id = ?');




app.get('/api/sightings', (req, res) => {
    res.json(fetchAllSightings.all());
});

app.post('/api/sightings', upload.single('imageInput'), (req, res) => {
    const {speciesInput: species, kind, date, latitude, longitude} = req.body;       //destructure sighting data


    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;

    if (!species || !date || !req.file || !kind) {
        return res.status(400).json({ error: 'species, kind, date, and image are required' });
    }

    const result = enterSighting.run(
        species,
        kind,
        date,
        latitude,
        longitude,
        req.file.filename
    );

    res.status(201).json({ id: result.lastInsertRowid });
});



app.delete('/api/sightings/:id', (req, res) => {
    const id = Number(req.params.id);  //parse the id
    const row = getSighting.get(id);   //grab the row by id

    if(!row){
        return res.status(404).json({ error: 'sighting not found' });
    }

    removeSighting.run(id);

    if (row.image) {
    fs.unlink(path.join(uploadDir, path.basename(row.image)), () => {});   // delete the photo too
    }

    res.status(204).end();
})




app.listen(3000, () => console.log('Running on http://localhost:3000'));