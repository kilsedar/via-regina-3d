define(["libraries/WebWorldWind-develop/src/WorldWind.js",
        "libraries/WebWorldWind-develop/src/util/Color.js",
        "libraries/WebWorldWind-develop/examples/LayerManager.js"],
       function (WorldWind, Color, LayerManager) {
  "use strict";

  var dbSettings = {db_points_url:"http://viaregina3.como.polimi.it/db_points_url", db_users_url:"http://viaregina3.como.polimi.it/db_users_url"};

  WorldWind.Logger.setLoggingLevel(WorldWind.Logger.LEVEL_WARNING);
  WorldWind.configuration.baseUrl = "libraries/WebWorldWind-develop/";
  WorldWind.BingMapsKey = "AkOk-CSt-kcpa4o6S8qZPtUEfPIRh__FfRTCl9nFu51qAMSJklQe8KiFFFNivIRD";

  var wwd = new WorldWind.WorldWindow("canvas");
  wwd.navigator.lookAtLocation.latitude = 46.15;
  wwd.navigator.lookAtLocation.longitude = 9.18;
  wwd.navigator.range = 10e4;

  var layers = [
    {layer: new WorldWind.BMNGLayer(), enabled: true},
    {layer: new WorldWind.BMNGLandsatLayer(), enabled: false},
    {layer: new WorldWind.BingAerialLayer(null), enabled: false},
    {layer: new WorldWind.BingAerialWithLabelsLayer(null), enabled: true},
    {layer: new WorldWind.BingRoadsLayer(null), enabled: false},
    {layer: new WorldWind.OpenStreetMapImageLayer(null), enabled: false},
    {layer: new WorldWind.CompassLayer(), enabled: true},
    {layer: new WorldWind.CoordinatesDisplayLayer(wwd), enabled: true},
    {layer: new WorldWind.ViewControlsLayer(wwd), enabled: true}
  ];

  for (var l = 0; l < layers.length; l++) {
    layers[l].layer.enabled = layers[l].enabled;
    wwd.addLayer(layers[l].layer);
  }

  /**
  * ADDING SHAPEFILE - beginning
  */
  var shapeConfigurationCallback = function (attributes, record) {
      var configuration = {};
      configuration.attributes = new WorldWind.ShapeAttributes(null);
      configuration.attributes.outlineColor = new WorldWind.Color(1.0, 0.0, 0.0, 0.8);
      configuration.attributes.outlineWidth = 4.0;
      return configuration;
  };

  var boundaryLayer = new WorldWind.RenderableLayer("Project area");
  var boundaryShapefile = new WorldWind.Shapefile("data/boundary/boundary.shp");
  boundaryShapefile.load(null, shapeConfigurationCallback, boundaryLayer);
  wwd.addLayer(boundaryLayer);
  /**
  * ADDING SHAPEFILE - end
  */

  // Check if the comment is empty that will be displayed in the dialog window which will open upon clicking on an icon. (CouchDB)
  function isCommentEmpty(comment) {
    if (comment == "")
      return "";
    else
      return "<b>Comment: </b>" + comment + "<br>";
  }

  // Check if the image is empty that will be displayed in the dialog window which will open upon clicking on an icon. (CouchDB)
  function isImageEmpty(id, length) {
    if (length != 0)
      return "<br><center><img src=http://viaregina3.como.polimi.it/db_points_url/" + id + "/image.jpg" + " height=150px></center><br>";
    else
      return "";
  }

  // Split the classes that will be displayed in the dialog window which will open upon clicking on an icon. (CouchDB)
  function splitClasses(str) {
    var txt = "";
    if (str == "support_for_traffic_artifacts")
      txt = "support for traffic/artifacts";
    else if (str == "bounding_escarpment")
      txt = "bounding/escarpment";
    else if (str == "accommodation_overnight")
      txt = "accommodation/overnight";
    else {
      var splitted = str.split("_");
      for (var i=0; i<splitted.length; i++) {
        txt += splitted[i];
        txt += " ";
      }
    }
    return txt;
  }

  // ODK
  function checkNullName(str) {
    if (str != null){
      return "<b>Name: </b>" + str + "<br>";
    }
    else
      return "";
  }

  // ODK
  function checkNullClass(str) {
    if (str != null){
      return "<b>Class: </b>" + str + "<br>";
    }
    else
      return "";
  }

  // ODK
  function checkNullSubclass(str) {
    if (str != null)
      return "<b>Subclass: </b>" + str + "<br>";
    else
      return "";
  }

  var placemark, placemarkAttributes = new WorldWind.PlacemarkAttributes(null), highlightAttributes, placemarkLayer = new WorldWind.RenderableLayer("Placemarks");
  placemarkAttributes.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 1.0, WorldWind.OFFSET_FRACTION, 0.0);
  placemarkAttributes.labelAttributes.color = new Color(0, 0, 0, 0);
  placemarkAttributes.labelAttributes.enableOutline = false;

  /**
  * COUCHDB ACCESS - beginning
  */
  var remoteAllCouch = dbSettings.db_points_url;
  var db = new PouchDB(remoteAllCouch);

  db.allDocs({include_docs: true, descending: true}, function(err, doc) {
    if (err) {
      console.log("There is an error!");
    }
    else {
      doc.rows.forEach(function(todo) {
        if(todo.doc.location!=null) {
          // console.log(todo.doc.location[0] + " " + todo.doc.location[1]);
          placemark = new WorldWind.Placemark(new WorldWind.Position(todo.doc.location[0], todo.doc.location[1]), true, null);
          placemark.label = "<div><b>Coordinates: </b>" + todo.doc.location[0].toPrecision(4) + ", " + todo.doc.location[1].toPrecision(4) + "<br>" +
  		                      "<b>Timestamp: </b>" + todo.doc.timestamp + "<br>" +
                            "<b>Classification: </b>" + splitClasses(todo.doc.classification) + "<br>" +
                            "<b>Rating: </b>" + todo.doc.rating + "<br>" +
                            isCommentEmpty(todo.doc.comment) +
                            isImageEmpty(todo.doc._id, todo.doc._attachments["image.jpg"].length) + "</div>";
          placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
          placemarkAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
          placemarkAttributes.imageSource = "images/marker-small.png";
          placemark.attributes = placemarkAttributes;

          highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
          highlightAttributes.imageScale = 1.5;
          placemark.highlightAttributes = highlightAttributes;

          placemarkLayer.addRenderable(placemark);
        }
      });
    }
  });
  /**
  * COUCHDB ACCESS - end
  */

  /**
  * ODK ACCESS - beginning
  */
  function urlMakeRequest(url) {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.onreadystatechange = function() {
      if(request.readyState == 4) {
        var jsonParse = JSON.parse(request.responseText);
        // console.log(jsonParse[0]["posiz_E:Longitude"]);

        for (var j = 0; j < jsonParse.length; j++){
          placemark = new WorldWind.Placemark(new WorldWind.Position(jsonParse[j]["posiz_E:Latitude"], jsonParse[j]["posiz_E:Longitude"]), true, null);
          placemark.label = "<div id=container><b>Date: </b>" + jsonParse[j].data_E + "<br>" +
		                        "<b>User: </b>" + jsonParse[j].tipo_utente + "<br>" +
                            checkNullName(jsonParse[j].nome_E) +
                            "<b>Group: </b>" + jsonParse[j].tipo_E + "<br>" +
                            checkNullClass(jsonParse[j].tipo_E_2) +
                            checkNullSubclass(jsonParse[j].tipo_E_3) +
                            "<br><center><img src='" + jsonParse[j].immagine_E.url + "' height='150px'></center></div>";
          placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
          placemarkAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
          placemarkAttributes.imageSource = "images/marker-small.png";
          placemark.attributes = placemarkAttributes;

          highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
          highlightAttributes.imageScale = 1.5;
          placemark.highlightAttributes = highlightAttributes;

          placemarkLayer.addRenderable(placemark);
        }
      }
    }
    request.send();
  }

  function request() {
    var url = "http://georep.como.polimi.it/ODKAggregate/view/binaryData?blobKey=aggregate.opendatakit.org%3APersistentResults[%40version%3Dnull+and+%40uiVersion%3Dnull]%2F_persistent_results[%40key%3Duuid%3A829309fa-312d-4809-9220-6d98c31a6624]";
    urlMakeRequest(url);
  }

  request();
  /**
  * ODK ACCESS - end
  */

  /**
  * DIALOGS DISPLAY - beginning
  */
  var highlightedItems = [];
  var popupOffset = 0;
  var popupHalfHeight = 0;

  var handlePick = function (o) {
    var x = o.clientX,
        y = o.clientY;

    var redrawRequired = highlightedItems.length > 0;

    for (var h = 0; h < highlightedItems.length; h++) {
      highlightedItems[h].highlighted = false;
    }
    highlightedItems = [];

    var pickList = wwd.pick(wwd.canvasCoordinates(x, y));
    if (pickList.objects.length > 0)
        redrawRequired = true;

    if (pickList.objects.length > 0) {
      for (var p = 0; p < pickList.objects.length; p++) {
        pickList.objects[p].userObject.highlighted = true;
        highlightedItems.push(pickList.objects[p].userObject);

        if(pickList.objects[p].userObject.label != undefined){
          $("#popup-json-text").html(pickList.objects[p].userObject.label);
          $("#popup-json").on("popupbeforeposition", function(event, ui){
            popupHalfHeight = (($("#popup-json").height()+34)/2)+25;
            popupOffset =  Math.ceil(o.pageY-popupHalfHeight);
            ui.x = x;
            ui.y = popupOffset;
          });
          $("#popup-json").popup("open");
        }
      }
    }

    if (redrawRequired)
      wwd.redraw();
  };

  $("#canvas").on("vclick", handlePick);
  /**
  * DIALOGS DISPLAY - end
  */

  wwd.addLayer(placemarkLayer);

  var layerManager = new LayerManager(wwd);
});
