/*
 * Copyright 2020 Akihiko Kusanagi
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 *
 * More information about this project is available at:
 *
 *    https://github.com/nagix/covid19-aichi-graph
 */

var DATA_URL = 'data/data.json';
var THEME_COLOR = '#3666b0';
var INITIAL_SCALE = 0.66;
var GRAPH_MARGIN = 20;

var initialNodes = [
	{ id: 'wuhan', label: '武漢' },
	{ id: 'hawai', label: 'ハワイ' },
	{ id: 'unknown', label: '不明' },
	{ id: 'france', label: 'フランス' },
	{ id: 'live-house', label: '大阪ライブハウス' }
];

var clusters = [
	{ id: 'gym-a', label: 'スポーツジムAクラスター', nodes:[4, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 51] },
	{ id: 'gym-b', label: 'スポーツジムBクラスター', nodes:[15, 23, 24, 26] },
	{ id: 'day-service-a', label: '高齢者デイサービスAクラスター', nodes:[30, 37, 38, 39, 46, 47] },
	{ id: 'day-service-b', label: '高齢者デイサービスBクラスター', nodes:[48, 49, 54, 55, 56, 60, 61, 62, 65, 66, 67, 73, 74, 75] }
];

var boxColors = {
	'男性': { stroke: '#559', fill: '#ccf' },
	'女性': { stroke: '#955', fill: '#fcc' },
	'非公表': { stroke: '#555', fill: '#ccc' }
};

var loadJSON = function(url) {
	return new Promise(function(resolve, reject) {
		var request = new XMLHttpRequest();

		request.open('GET', url);
		request.onreadystatechange = function() {
			if (request.readyState === 4) {
				if (request.status === 200) {
					resolve(JSON.parse(request.response));
				} else {
					reject(Error(request.statusText));
				}
			}
		};
		request.send();
	});
};

var fullwidthToHalfwith = function(s) {
	return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
		return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
	});
};

var tooltip = d3.select('body').append('div')
	.attr('class', 'tooltip')
	.style('opacity', 0);

loadJSON(DATA_URL).then(function(data) {

	document.getElementById('last-update').innerHTML = data.patients.date;

	var graph = new dagreD3.graphlib.Graph({ compound: true });
	graph.setGraph({ rankdir: 'LR' });

	initialNodes.forEach(function(node) {
		var id = node.id;

		return graph.setNode(id, {
			id: id,
			label: node.label,
			width: 120,
			height: 30,
			rx: 5,
			ry: 5,
			style: 'stroke: #aaa; fill: #fff;'
		});
	});

	data.patients.data.forEach(function(patient) {
		var id = patient['No'];
		var address = patient['居住地'];
		var age = patient['年代'];
		var sex = patient['性別'];
		var remarks = patient['備考'] || '';
		var supplement = patient['補足'] || '';
		var dead = remarks.match(/死亡/);
		var colors = boxColors[sex];
		var sourceIds = (supplement.match(/[0-9０-９]+/g) || ['unknown'])
			.map(fullwidthToHalfwith)
			.map(function(sourceId) {
				return !isNaN(sourceId) && sourceId < id ? sourceId : 'unknown';
			});

		if (supplement.match(/武漢/)) {
			sourceIds = ['wuhan'];
		} else if (supplement.match(/ハワイ/)) {
			sourceIds = ['hawai'];
		} else if (supplement.match(/フランス/)) {
			sourceIds = ['france'];
		} else if (supplement.match(/ライブハウス/)) {
			sourceIds = ['live-house'];
		}

		graph.setNode(id, {
			id: id,
			labelType: 'html',
			label: '<div class="container">' +
				'<div class="id" style="background-color: ' + colors.stroke + ';">' + id + '</div>' +
				'<div class="label">' + age + sex + '</div>' + (
					dead ? '<div class="dead badge">死亡</div>' : ''
				) + '</div>',
			labelpos: 'l',
			width: 160,
			height: 30,
			rx: 5,
			ry: 5,
			style: 'stroke: ' + colors.stroke +
				'; fill: ' + colors.fill,
			description: 'No: ' + id +
				'<br>居住地: ' + address +
				'<br>年代: ' + age +
				'<br>性別: ' + sex +
				'<br>備考: ' + remarks +
				'<br>補足: ' + supplement +
				'<br>発表日: ' + patient['short_date']
		});

		sourceIds.forEach(function(sourceId) {
			graph.setEdge(sourceId, id, {
				sourceId: sourceId < id ? sourceId : 'unknown',
				targetId: id,
				label: '',
				arrowhead: 'normal',
				lineInterpolate: 'monotone',
				lineTension: 0.0,
				style: 'stroke: #aaa; fill: none; stroke-width: 1.5px;',
				arrowheadStyle: 'fill: #aaa'
			});
		});

		clusters.forEach(function(cluster) {
			if (cluster.nodes.indexOf(id) !== -1) {
				graph.setParent(id, cluster.id)
			}
		});
	});

	clusters.forEach(function(cluster) {
		var id = cluster.id;

		graph.setNode(id, {
			id: id,
			label: cluster.label,
			clusterLabelPos: 'top',
			style: 'fill: ' + THEME_COLOR + '; opacity: 0.2;',
			nodes: cluster.nodes
		});
	});

	var svg = d3.select('#network');
	var inner = svg.select('g');

	var zoom = d3.zoom()
		.on('zoom', function () {
			inner.attr('transform', d3.event.transform);
		});
	svg.call(zoom);

	var render = new dagreD3.render();
	render(inner, graph);

	inner.selectAll('g.node')
		.on('mouseover', function(d) {
			var description = graph.node(d).description;

			if (description) {
				tooltip.transition()
					.duration(200)
					.style('opacity', .9);
				tooltip.html(description)
					.style('left', (d3.event.pageX) + 'px')
					.style('top', (d3.event.pageY - 28) + 'px');
			}
		})
		.on('mouseout', function(d) {
			tooltip.transition()
				.duration(500)
				.style('opacity', 0);
		})

	var width = graph.graph().width;
	var height = graph.graph().height;
	var svgElement = svg.node();

	var resetHeight = function() {
		svgElement.style.height =
			document.body.clientHeight - svgElement.getBoundingClientRect().top;
	}

	var redraw = function(event) {
		var initialTransform = event.transform || {};
		var transform = d3.zoomTransform(svgElement);
		var k = initialTransform.k || transform.k;
		var x = initialTransform.x || transform.x / k;
		var y = initialTransform.y || transform.y / k;

		resetHeight();

		var clientWidth = svgElement.clientWidth;
		var clientHeight = svgElement.clientHeight;
		var xScale = clientWidth / (width + GRAPH_MARGIN * 2);
		var yScale = clientHeight / (height + GRAPH_MARGIN * 2);
		var dx = clientWidth / k - width;
		var dy = clientHeight / k - height;
		var extent = [
			Math.min(xScale, yScale, INITIAL_SCALE),
			Math.max(xScale, yScale, 1)
		];
		var scale = Math.min(Math.max(k, extent[0]), extent[1]);
		var xOffset = xScale > k ? dx / 2 : Math.max(x, dx - GRAPH_MARGIN);
		var yOffset = yScale > k ? dy / 2 : Math.max(y, dy - GRAPH_MARGIN);

		zoom.scaleExtent(extent)
			.transform(svg, d3.zoomIdentity
				.scale(scale)
				.translate(xOffset, yOffset)
			);
	};

	var extent = [
		[-GRAPH_MARGIN , -GRAPH_MARGIN],
		[width + GRAPH_MARGIN, height + GRAPH_MARGIN]
	];
	zoom.translateExtent(extent);

	resetHeight();
	redraw({
		transform: {
			k: INITIAL_SCALE,
			x: Math.max((svgElement.clientWidth / INITIAL_SCALE - width) / 2, GRAPH_MARGIN),
			y: Math.max((svgElement.clientHeight / INITIAL_SCALE - height) / 2, GRAPH_MARGIN)
		}
	});

	window.addEventListener('resize', redraw);

});
