var zlib = require("zlib");
const cors = require("cors");

let app = require("express")();
var mapnik = require("mapnik");
let SphericalMercator = require("@mapbox/sphericalmercator");

app.use(cors());

var mercator = new SphericalMercator({
  size: 256, // tile size
});

var geojson_settings = {
  type: "geojson",
  file: "./data.geojson",
};

mapnik.register_default_input_plugins();

app.get("/api/v1/tiles/:zoom/:x/:y/:mark?/:all?", function (req, res) {
  var options = {
    x: parseInt(req.params.x),
    y: parseInt(req.params.y),
    z: parseInt(req.params.zoom),
  };

  console.log(req.params);
  makeVectorTile(options).then(function (vectorTile) {
    zlib.deflate(vectorTile, function (err, data) {
      if (err) return res.status(500).send(err.message);
      res.setHeader("Content-Encoding", "deflate");
      res.setHeader("Content-Type", "application/x-protobuf");
      res.send(data);
    });
  });
});

function makeVectorTile(options) {
  var extent = mercator.bbox(options.x, options.y, options.z, false, "3857");
  console.log("TES ", options);
  var map = new mapnik.Map(256, 256, "+init=epsg:3857");
  map.extent = extent;

  var layer = new mapnik.Layer("test");
  layer.datasource = new mapnik.Datasource(geojson_settings);
  layer.styles = ["default"];
  map.add_layer(layer);

  return new Promise(function (resolve, reject) {
    var vtile = new mapnik.VectorTile(
      parseInt(options.z),
      parseInt(options.x),
      parseInt(options.y)
    );
    map.render(vtile, function (err, vtile) {
      if (err) return reject(err);
      resolve(vtile.getData());
    });
  });
}

app.listen(3000, function () {
  console.log("Server is running on port 3000");
});
