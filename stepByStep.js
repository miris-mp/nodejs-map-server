let app = require("express")();
let cors = require("cors");
const { createCanvas } = require("canvas");
const mapnik = require("mapnik");
const fs = require("fs/promises");
const turf = require("@turf/turf");
const SphericalMercator = require("@mapbox/sphericalmercator");

app.use(cors());

// setting up a server to listen on port 8000
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const TILE_LENGTH = 256;

// Initialize Mapnik
mapnik.register_default_input_plugins();
mapnik.register_default_fonts();

// Create a map object
const map = new mapnik.Map(TILE_LENGTH, TILE_LENGTH);

app.get("/image", (req, res) => {
  const zoom = 6;
  const lat = 42.3601; // Example center latitude
  const lon = 13.0589; // Example center longitude

  const [centerLat, centerLon] = deg2num(lat, lon, zoom);

  // NOT NEEDED
  // calculate number of max tiles
  if (0 < zoom <= 20) {
    const maxNumTiles = Math.pow(2, zoom);
    console.log("max number of tiles ", maxNumTiles);
  }

  // WRONG: To obtain tile width
  //360 represents the total range of longitudes (from -180 to 180 degrees
  //const tileWidth = 360 / Math.sqrt(Math.pow(2, zoom));

  // Calculate the resolution (degrees per pixel) at the given zoom level
  const resolution = 360 / Math.pow(2, zoom) / TILE_LENGTH;

  const tileWidthDegrees = 256 * resolution;
  const centerLatRadians = (centerLat * Math.PI) / 180;
  const adjustedTileWidthDegrees =
    tileWidthDegrees / Math.cos(centerLatRadians);

  // Calculate the half-width and half-height of the tile in degrees
  const halfTileSizeDegrees = (TILE_LENGTH * resolution) / 2;

  // Calculate the bounding box
  const bbox = [
    centerLon - halfTileSizeDegrees,
    centerLat - halfTileSizeDegrees,
    centerLon + halfTileSizeDegrees,
    centerLat + halfTileSizeDegrees,
  ];

  // Create a canvas with specified dimensions
  const canvas = createCanvas(TILE_LENGTH, TILE_LENGTH);
  const CIRCLE_RADIUS = 4;
  const ctx = canvas.getContext("2d");

  const pointA = turf.point([bbox[0], bbox[2]]);
  const pointB = turf.destination(pointA, bbox[1], bbox[3]);

  console.log("Other bbox ", pointA, " and ", pointB);

  console.log("turf ", turf.bbox(pointA, pointB));
  const merc = new SphericalMercator({ size: TILE_LENGTH });
  bboxMerc = merc.bbox(centerLat, centerLon, zoom);
  console.log(bboxMerc);

  // save data of coords
  readGeoJSONFile("./data.geojson").then((geojsonData) => {
    geojsonData.features.forEach((feature) => {
      let lon = feature.geometry.coordinates[0];
      let lat = feature.geometry.coordinates[1];

      if (
        bboxMerc[0] < lon &&
        lon < bboxMerc[2] &&
        bboxMerc[1] < lat &&
        lat < bboxMerc[3]
      ) {
        console.log("IL PUNTO APPARTIENE AL RANGE");

        let pxCoords = latLonToPixelCoords(lat, lon, zoom);

        console.log("Pixel coords ", pxCoords);

        // Set background color
        ctx.fillStyle = "lightblue";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw a rectangle
        ctx.fillStyle = "green";

        ctx.arc(
          Math.floor(pxCoords.x),
          Math.floor(pxCoords.y),
          CIRCLE_RADIUS,
          0,
          Math.PI * 2
        );
        ctx.closePath();
        ctx.fill();
      }
      // Create a PNG stream
      const stream = canvas.createPNGStream();
      // Set the content type header to indicate that a PNG image is being sent
      res.setHeader("Content-Type", "image/png");

      // Pipe the PNG stream to the response object
      stream.pipe(res);
    });
  });

  //   // ex point
  //   const centerPoint = [43, 13];
  //   const point = turf.point(centerPoint);
  //   const halfTileSize = TILE_LENGTH / 2;
  //   const bbox = turf.bbox(turf.buffer(point, halfTileSize));
  //   console.log("Point ", point);
  //   console.log(bbox);

  map.background = new mapnik.Color("lightblue");

  // Create a new layer
  const layer = new mapnik.Layer("My Layer", "+proj=latlong +datum=WGS84");
  layer.datasource = new mapnik.Datasource({
    type: "geojson",
    inline: JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [0, 0],
          },
        },
      ],
    }),
  });

  async function readGeoJSONFile(filePath) {
    let geojsonData;
    try {
      const data = await fs.readFile(filePath, { encoding: "utf8" });
      geojsonData = JSON.parse(data);
    } catch (err) {
      geojsonData = "";
    } finally {
      return geojsonData;
    }
  }

  layer.styles = ["My Style"];
  map.add_layer(layer);

  // Create a style object
  //   const style = new mapnik.Style();
  //   style.rules.push(
  //     new mapnik.Rule().addSymbolizer(
  //       new mapnik.PolygonSymbolizer(new mapnik.Color("green"))
  //     )
  //   );
  //   map.add_style("My Style", style);

  // Create a style
  // map.loadSync("./stylesheet.xml");

  // Render the map
  const im = new mapnik.Image(256, 256);
  // map.render(im, (err, im) => {
  //   if (err) throw err;
  //   im.encode("png", (err, buffer) => {
  //     if (err) throw err;
  //     // fs.writeFileSync("output.png", buffer);
  //     console.log("Map image saved as output.png");
  //   });
  // });
});

function latLonToPixelCoords(lat, lon, zoom) {
  const EarthRadius = 6378137; // Earth's radius in meters (for Web Mercator projection)
  const InitialResolution = (2 * Math.PI * EarthRadius) / TILE_LENGTH; // Initial resolution (meters per pixel) at zoom level 0
  const OriginShift = (2 * Math.PI * EarthRadius) / 2.0; // Offset for the Web Mercator projection

  // Calculate meters per pixel at the given zoom level
  const resolution = InitialResolution / Math.pow(2, zoom);

  // Calculate the pixel coordinates relative to the top-left corner of the tile
  const pixelX = ((lon + 180) / 360) * TILE_LENGTH;
  const pixelY =
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
    TILE_LENGTH;

  return { x: pixelX, y: pixelY };
}

function deg2num(lat_deg, lon_deg, zoom) {
  const lat_rad = (lat_deg * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const xtile = Math.floor(((lon_deg + 180) / 360) * n);
  const ytile = Math.floor(
    ((1 - Math.asinh(Math.tan(lat_rad)) / Math.PI) / 2) * n
  );

  console.log("DEG ", xtile, " and ", ytile);
  return [xtile, ytile];
}

function calculateNumberOfTiles(zoom, north, west, south, east) {
  // calculate coords of tile for the zoom level specified
  const maxTiles = 2 ** zoom;

  // Converts coords in geo tile
  const x1 = Math.floor(((west + 180) / 360) * maxTiles);
  const x2 = Math.floor(((east + 180) / 360) * maxTiles);
  const y1 = Math.floor(((90 - north) / 180) * maxTiles);
  const y2 = Math.floor(((90 - south) / 180) * maxTiles);

  // Calcola il numero di tile richieste
  const numTiles = (x2 - x1 + 1) * (y2 - y1 + 1);
  return numTiles;
}
