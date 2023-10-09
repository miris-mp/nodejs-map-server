const http = require("http");
const mapnik = require("mapnik");
const sharp = require("sharp");

const server = http.createServer((req, res) => {
  // Gestisci le richieste qui
  const url = require("url");

  server.on("request", (req, res) => {
    const { pathname } = url.parse(req.url);
    const [_, z, x, y] = pathname.split("/").map(Number);

    // Genera la tile con Mapnik e inviala al client
    generateTile(z, x, y, (err, tile) => {
      if (err) {
        res.statusCode = 500;
        res.end("Errore nella generazione della tile");
      } else {
        res.setHeader("Content-Type", "image/png");
        res.end(tile);
      }
    });
  });
});

function generateTile(z, x, y, callback) {
  const map = new mapnik.Map(256, 256);
  map.loadSync("path/to/your/map.xml"); // Configura il tuo stile di mappa

  const options = {
    // Definisci la bounding box della tile in coordinate mercator
    bbox: map.extent,
    width: 256,
    height: 256,
    buffer_size: 256,
    format: "png",
  };

  const im = new mapnik.Image(256, 256);
  map.render(im, options, (err, im) => {
    if (err) {
      callback(err);
    } else {
      const buffer = im.encodeSync("png");
      callback(null, buffer);
    }
  });
}

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
