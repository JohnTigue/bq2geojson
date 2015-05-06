/**
 * Creates the map legend that will appear in the lower right corner of the map.
 *
 * @returns {object} DOM object for map legend
 */
function addLegend() {
	var legend = L.control({position: 'bottomright'});

	legend.onAdd = function(map) {
	    var div = L.DomUtil.create('div', 'info legend'),
	        grades = [0, 5, 10, 25, 50];

		div.innerHTML = '<i style="background: black; opacity: .2">' +
			'</i>Insuff. data<br/>';
	    for ( var i = 0; i < grades.length; i++ ) {
	        div.innerHTML +=
	            '<i style="background:' + getHexColor(grades[i] + 1) +
				'"></i> ' + (i == 0 ? '0' : grades[i]) + (grades[i + 1] ?
				'&ndash;' + grades[i + 1] + ' Mbps<br/>' : '+ Mbps');
	    }
	    return div;
	};
	legend.addTo(map);
}

/**
 * Add various map controls to the lower left corner of the map.
 *
 * @returns {object} DOM object for the controls box
 */
function addControls() {
	var controls = L.control({position: 'bottomleft'});

	controls.onAdd = function(map) {
		var controls = L.DomUtil.create('div', 'info controls'),
			labelYear = L.DomUtil.create('span', 'mapControls', controls),
			selectYear = L.DomUtil.create('select', 'mapControls', controls),
			labelMetric = L.DomUtil.create('span', 'mapControls', controls),
			selectMetric = L.DomUtil.create('select', 'mapControls', controls),
			labelRes = L.DomUtil.create('span', 'mapControls', controls),
			selectRes = L.DomUtil.create('select', 'mapControls', controls),
			sliderMonth = L.DomUtil.create('div', 'mapControls', controls),
			checkAnimate = L.DomUtil.create('div', 'mapControls', controls),
			date_options = '';

		for ( var year in dates ) {
			date_options += '<option value="' + year + '">' + year +
				'</option>';
		}

		checkAnimate.innerHTML = '<input id="checkAnimate"' +
			'type="checkbox" />Animate map';
		
		sliderMonth.setAttribute('id', 'sliderMonth');
		// Prevent the entire map from dragging when the slider is dragged.
		L.DomEvent.disableClickPropagation(sliderMonth);

		labelYear.innerHTML = 'Year';
		selectYear.innerHTML = date_options;
		selectYear.setAttribute('id', 'selectYear');

		labelMetric.innerHTML = 'Metric';
		selectMetric.innerHTML = '<option value="download_median">' +
			'DL throughput</option><option value="upload_median">' +
			'UL throughput</option>';
		selectMetric.setAttribute('id', 'selectMetric');

		labelRes.innerHTML = 'Res.';
		selectRes.innerHTML = '<option value="low">Low</option>' +
			'<option value="medium">Medium</option>' +
			'<option value="high">High</option>';
		selectRes.setAttribute('id', 'selectRes');

		return controls;
	};

	controls.addTo(map);

	[selectYear, selectMetric, selectRes].forEach( function(elem) {
		elem.addEventListener('change',
			function (e) { updateLayers(e, 'update'); });
	});

	var clearId;
	$('#checkAnimate').change( function() {
		if ( $('#checkAnimate').prop('checked') ) {
			var i = $('#sliderMonth').slider('value');
			clearId = setInterval( function() {
				$('#sliderMonth').slider('value', i + 1);
				i = (i + 1) % dates[$('#selectYear').val()].length;
			}, animateInterval);
		} else {
			clearInterval(clearId);
		}
	});

	// Can't instantiate the slider until after "controls" is actually added to
	// the map.
	$('#sliderMonth')
		.slider({
			min: Number(dates[defaultYear][0]),
			max: Number(dates[defaultYear][dates[defaultYear].length - 1]),
			change: function (e, ui) {
				updateLayers(e, 'update');
			}
		})
		.slider('pips', {
			rest: 'label',
			labels: monthNames.slice(0, dates[defaultYear].length)
		});;
}

/**
 * Update the map when some event gets triggered that requires the map to
 * displays something else.
 *
 * @param {object} e Event object
 * @param {string" mode What state are we in? New or update?
 */
function updateLayers(e, mode) {
	var year = $('#selectYear').val(),
		metric = $('#selectMetric').val(),
		resolution = $('#selectRes').val();

	// If the year was changed then we need to update the slider and set it's
	// value to the first configured month for that year.
	if ( e.target.id == 'selectYear' ) {
		$('#sliderMonth')
			.slider('option', 'min', Number(dates[year][0]))
			.slider('option', 'max', Number(
				dates[year][dates[year].length - 1]))
			.slider().slider('pips', {
				rest: 'label',
				labels: monthNames.slice(0, dates[year].length)
			});

		// This is a really ugly hack, but we don't want the onchange event to
		// fire when changing the slider value from within the updateLayers()
		// function, else changing the slider value actually triggers the
		// updateLayers() function to run a second time.  There must be a better
		// way to do this, but for now just remove the onchange event function,
		// change the value, then re-add it.
		$('#sliderMonth').slider('option', 'change', function(){});
		$('#sliderMonth').slider('value', dates[year][0]);
		$('#sliderMonth').slider('option', 'change',
			function(e, ui){ updateLayers(e, 'update')});

		if ( seedCache ) {
			seedLayerCache(year);
		}
	}

	var month = $('#sliderMonth').slider('value');

	if ( overlays['hex']['enabled'] ) {
		setHexLayer(year, month, metric, resolution, mode);
	}
	if ( overlays['plot']['enabled'] ) {
		setPlotLayer(year, month, mode);
	}
}

/**
 * Determines the color of a polygon based on a passed metric.
 *
 * @param {number} val Metric to evaluate
 * @returns {string} A string representing the color
 */
function getHexColor(val) {
    return val > 50 ? 'blue' :
           val > 25  ? 'green' :
           val > 10  ? 'purple' :
           val > 5  ? 'yellow' :
           val > 0   ? 'red' : 'transparent';
}

/**
 * Fetches layer data from the server.
 *
 * @param {string} url URL where resource can be found
 * @param {function} callback Callback to pass server response to
 */
function getLayerData(url, callback) {
	if ( geoJsonCache[url] ) {
		console.log('Using cached version of ' + url);
		callback(geoJsonCache[url]);
	} else {
		console.log('Fetching and caching ' + url);
		$.get(url, function(response) {
			geoJsonCache[url] = response;
			callback(response)
		}, 'json');
	}
}

/**
 * Applies a layer to the map.
 *
 * @param {string} year Year of layer to set
 * @param {string} month Month of layer to set
 * @param {string} metric Metric to be represented in layer
 * @param {string} resolution For hexbinned map, granularity of hex layer
 * @param {string" mode What state are we in? New or update?
 */
function setHexLayer(year, month, metric, resolution, mode) {

	// Don't display spinner if animation is happening
	if ( $('#checkAnimate').prop('checked') === false ) {
		$('#spinner').css('display', 'block');
	}

	month = month < 10 ? '0' + month : month;
	var hex_url = 'geojson/' + year + '_' + month + '-' + resolution + '.json';

	if ( mode == 'update' ) {
		layerCtrl.removeLayer(hexLayer);
	}

	getLayerData(hex_url, function(response) {
		response.features.forEach( function(cell) {

			var value = cell.properties[metric];
			var hexStyle = cell.hexStyle = {};

			hexStyle.weight = 1;
			hexStyle.fillOpacity = 0.5;

			if ( ! value ) {
				hexStyle.weight = 0;
				hexStyle.fillOpacity = 0;
			} else if ( metric == 'download_median' &&
					cell.properties['download_count'] < 30 ) {
				hexStyle.weight = 0.5;
				hexStyle.fillOpacity = 0.05;
				hexStyle.color = 'black';
			} else if ( metric == 'upload_median' &&
					cell.properties['upload_count'] < 30 ) {
				hexStyle.weight = 0.5;
				hexStyle.fillOpacity = 0.05;
				hexStyle.color = 'black';
			} else {
				hexStyle.color = getHexColor(value);
			}
		});

		if ( map.hasLayer(hexLayer) ) {
			map.removeLayer(hexLayer);
			var hexLayerVisible = true;
		}

		hexLayer = L.geoJson(response).eachLayer( function(l) {
			if ( metric = "download_median" &&
					l.feature.properties.download_count > 0 ) {
				l.bindPopup(make_popup(l.feature.properties));
			}
			if ( metric = "upload_median" &&
					l.feature.properties.upload_count > 0 ) {
				l.bindPopup(make_popup(l.feature.properties));
			}
			l.setStyle(l.feature['hexStyle']);
		});

		layerCtrl.addOverlay(hexLayer, 'Hex layer');

		if ( hexLayerVisible || (mode == 'new' &&
				overlays['hex']['defaultOn']) ) {
			map.addLayer(hexLayer);
		}

	});

	$('#spinner').css('display', 'none');
}

/**
 * Applies a scatter plot layer to the map.
 *
 * @param {string} year Year of layer to set
 * @param {string} month Month of layer to set
 * @param {string" mode What state are we in? New or update?
 */
function setPlotLayer(year, month, mode) {

	// Don't display spinner if animation is happening
	if ( $('#checkAnimate').prop('checked') === false ) {
		$('#spinner').css('display', 'block');
	}

	month = month < 10 ? '0' + month : month;
	var plot_url = 'geojson/' + year + '_' + month + '-plot.json';

	if ( mode == 'update' ) {
		layerCtrl.removeLayer(plotLayer);
	}

	getLayerData(plot_url, function(response) {
		if ( map.hasLayer(plotLayer) ) {
			map.removeLayer(plotLayer);
			var plotLayerVisible = true;
		}

		plotLayer = L.geoJson(response, {
			pointToLayer: function(feature, latlon) {
				return L.circleMarker(latlon, {
					radius: 1,
					fillColor: '#000000',
					fillOpacity: 1,
					stroke: false
				});
			}
		});

		layerCtrl.addOverlay(plotLayer, 'Plot layer');

		if ( plotLayerVisible ||
				(mode == 'new' && overlays['plot']['defaultOn']) ) {
			map.addLayer(plotLayer);
		}
	});

	$('#spinner').css('display', 'none');
}

/**
 * Takes a year and attempts to load the low resolution hex data layer into
 * memory in the background to speed switching between months for the current
 * year.
 * 
 * @param {string} year Year of layer to set
 */
function seedLayerCache(year) {
	var months = dates[year].slice(1);
	for ( i = 0; i < months.length; i++ ) {
		month = months[i] < 10 ? '0' + months[i] : months[i];
		var url = 'geojson/' + year + '_' + month + '-low.json';
		getLayerData(url, function(){});
	}
}

/**
 * Creates a popup with information about a polygon.
 *
 * @param {object} props Properties for a polygon
 * @returns {string} Textual information for the popup
 */
function make_popup(props) {
	var popup = 'DL: median:' + Math.round(props.download_median * 10) / 10 +
		' Mbps / mean:' + Math.round(props.download_avg * 10) / 10 +
		' Mbps / pts:' + Math.round(props.download_count * 10) / 10 +
		'<br/>UL: median:' + Math.round(props.upload_median * 10) / 10 +
		' Mbps / mean:' + Math.round(props.upload_avg * 10) / 10 + ' Mbps' +
		' / pts:' + Math.round(props.upload_count * 10) / 10 + '<br/>' +
		'RTT (mean): ' + Math.round(props.rtt_avg) + ' ms';
	return popup;
}
