const mapnik = require("mapnik");
let app = require("express")();
const cors = require("cors");
const fs = require("fs");

app.use(cors());

// Server port
const PORT = process.env.PORT || 8000;

mapnik.register_default_input_plugins();
const proj4 =
  "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs";

const createVectorTile = (geojson, { zoom, x, y }) => {
  if (!fs.existsSync(geojson)) {
    throw new Error(`GeoJSON file does not exist: ${geojson}`);
  }

  const map = new mapnik.Map(256, 256, proj4);
  let layer = new mapnik.Layer("tile", proj4);
  layer.datasource = new mapnik.Datasource({
    type: "geojson",
    file: geojson, // Set the GeoJSON file path here
  });
  map.add_layer(layer);

  const vector = new mapnik.VectorTile(Number(zoom), Number(x), Number(y));

  return new Promise((res, rej) => {
    map.render(vector, (err, vectorTile) => {
      if (err) return rej(err);
      vectorTile.getData((err, buffer) => {
        if (err) return rej(err);
        return res(buffer);
      });
    });
  });
};

// Route handler from above

app.get("/api/v1/tiles/:zoom/:x/:y/:mark?/:all?", async (req, res) => {
  const geojson = "./data.geojson"; // Provide the path to your GeoJSON file here
  const tile = await createVectorTile(geojson, req.params);
  res
    .setHeader("Content-Type", "application/x-protobuf")
    .status(200)
    .send(tile);
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);
