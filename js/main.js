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

var initialNodes = [
	{ id: 'wuhan', label: '武漢', width: 100, height: 30, rx: 5, ry: 5, style: 'stroke: #aaa; fill: #fff;' },
	{ id: 'hawai', label: 'ハワイ', width: 100, height: 30, rx: 5, ry: 5, style: 'stroke: #aaa; fill: #fff;' },
	{ id: 'unknown', label: '不明', width: 100, height: 30, rx: 5, ry: 5, style: 'stroke: #aaa; fill: #fff;' },
	{ id: 'france', label: 'フランス', width: 100, height: 30, rx: 5, ry: 5, style: 'stroke: #aaa; fill: #fff;' }
];

var clusters = [
	{ id: 'gymA', label: 'スポーツジムAクラスター', clusterLabelPos: 'top', style: 'stroke: #cc9; fill: #ffc;', nodes:[4, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 51] },
	{ id: 'gymB', label: 'スポーツジムBクラスター', clusterLabelPos: 'top', style: 'stroke: #cc9; fill: #ffc;', nodes:[15, 23, 24, 26] }
];

var boxColors = {
	'男性': {stroke: '#559', fill: '#ccf'},
	'女性': {stroke: '#955', fill: '#fcc'}
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

	var graph = new dagreD3.graphlib.Graph({ compound: true });
	graph.setGraph({ rankdir: 'LR' });

	initialNodes.forEach(function(node) {
		return graph.setNode(node.id, node);
	});

	data.patients.data.forEach(function(patient) {
		var id = patient['No'];
		var remarks = patient['備考'] || '';
		var supplement = patient['補足'] || '';
		var dead = remarks.match(/死亡/);
		var colors = boxColors[patient['性別']];
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
		}

		graph.setNode(id, {
			id: id,
			labelType: 'html',
			label: '<div class="container">' +
				'<div class="id" style="background-color: ' + colors.stroke + ';">' +
				id + '</div><div class="label">' +
				patient['年代'] + patient['性別'] +
				'</div></div>',
			labelpos: 'l',
			width: 120,
			height: 30,
			rx: 5,
			ry: 5,
			style: 'stroke: ' + (dead ? '#f00' : colors.stroke) +
				'; stroke-width: ' + (dead ? 3 : 1) +
				'; fill: ' + colors.fill,
			description: 'No: ' + id +
				'<br>居住地: ' + patient['居住地'] +
				'<br>年代: ' + patient['年代'] +
				'<br>性別: ' + patient['性別'] +
				'<br>備考: ' + (patient['備考'] || '') +
				'<br>補足: ' + (patient['補足'] || '') +
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
		graph.setNode(cluster.id, cluster);
	});

	var svg = d3.select('#network');
	var inner = svg.select('g');

	var zoom = d3.behavior.zoom().on('zoom', function () {
		inner.attr('transform', 'translate(' + d3.event.translate + ')' +
			'scale(' + d3.event.scale + ')');
	});
	svg.call(zoom);

	var render = new dagreD3.render();
	render(inner, graph);

	inner.selectAll('g.node')
		.on('mouseover', function(d) {
			tooltip.transition()
				.duration(200)
				.style('opacity', .9);
			tooltip.html(graph.node(d).description)
				.style('left', (d3.event.pageX) + 'px')
				.style('top', (d3.event.pageY - 28) + 'px');
		})
		.on('mouseout', function(d) {
			tooltip.transition()
				.duration(500)
				.style('opacity', 0);
		})

	var initialScale = 0.66;
	zoom
		.translate([(svg.attr('width') - graph.graph().width * initialScale) / 2, 20])
		.scale(initialScale)
		.event(svg);
	svg.attr('height', graph.graph().height * initialScale + 40);

	document.getElementById('last-update').innerHTML = data.patients.date;
});
