import Utils from "../Utils.js";
import DRMetaDataset from "../data/DRMetaDataset.js";
import Chart from "./Chart.js";

/**
 * Hexagonal heatmap.
 * Note: Functionality for integration with crossfilter.js should be mixin, lack of time enforces this half-baked
 * approach.
 */
export default class HexagonalHeatmap extends Chart
{
    /**
     * Instantiates new HexagonalHeatmap.
     * @param name
     * @param panel
     * @param dataset Expects dataset of Type as list of dicts with a set of properties including id, x, y. Other
     * properties are not mandatory.
     * @param attributes List of length 2, containing identifiers of attributes to use for x- respectively y-axis.
     * @param style Various style settings (chart width/height, colors, ...). Arbitrary format, has to be parsed indivdually
     * by concrete classes.
     * @param parentDivID
     */
    constructor(name, panel, attributes, dataset, style, parentDivID)
    {
        super(name, panel, attributes, dataset, style, parentDivID);

        // Used to store max. value in heatmap cell - important for setting color of cells.
        this._maxCellValue = null;

        // Update involved CSS classes.
        $("#" + this._target).addClass("hexagonal-heatmap");

        // Construct heatmap.
        this.constructCFChart();
    }

    render()
    {
        throw new TypeError("HexagonalHeatmap.render(): Not implemented yet.");
    }

    constructCFChart()
    {
        let attrs       = this._attributes;
        const target    = $("#" + this._target);
        const radius    = 5;
        const margin    = {top: radius + 5, right: radius + 5, bottom: radius + 20, left: radius + 10};
        const width     = target.width() - margin.left - margin.right;
        const height    = target.height() - margin.top - margin.bottom;

        // --------------------------------------
        // 1. Filter and transform records.
        // --------------------------------------

        let extrema = {
            [attrs[0]]: {max: -Infinity, min: 0},
            [attrs[1]]: {max: -Infinity, min: 0}
        };

        let records = [];
        for (const record of this._dataset) {
            // todo Filtering of records w.r.t. to detail view scatterplots.
            records.push([record[attrs[0]], record[attrs[1]]]);

            for (let attr of attrs) {
                if (extrema[attr].max < record[attr])
                    extrema[attr].max = record[attr];
            }
        }
        let normalizedRecords = records.map(record => ([
            width * record[0] / extrema[attrs[0]].max,
            height * record[1] / extrema[attrs[1]].max
        ]));

        // --------------------------------------
        // 2. Bin records.
        // --------------------------------------

        // Bin records.
        let hexbin = d3.hexbin()
            .extent([[-margin.left, -margin.top], [width + margin.right, height + margin.bottom]])
            .radius(radius);
        let bins = hexbin(normalizedRecords);

        // Find cell content extrema.
        const maxElemCount = Math.max(...bins.map(bin => bin.length));

        // --------------------------------------
        // 3. Append/reset SVG to container div.
        // --------------------------------------

        // Define color range.
        let colors = d3
            .scaleLinear()
            .domain([0, Math.log10(maxElemCount)])
            .range(["#fff7fb", "#1f77b4"]);

        // Draw heatmap.
        let svg = d3.select("#" + this._target).select("svg");
        if (!svg.empty())
            svg.remove();
        // Append SVG.
        svg = d3.select("#" + this._target).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // --------------------------------------
        // 4. Draw heatmap.
        // --------------------------------------

        svg.append("g")
            .attr("class", "hexagons")
            .selectAll("path")
            .data(bins)
            .enter().append("path")
            .attr("d", hexbin.hexagon())
            .attr("transform", d => "translate(" + d.x + "," + d.y + ")")
            .style("fill", d => colors(Math.log10(d.length)));

        // Add axes.
        let xAxisScale = d3.scale
            .linear()
            .domain([0, extrema[attrs[0]].max])
            .range([0, target.width()]);
        let yAxisScale = d3.scale
            .linear()
            .domain([0, extrema[attrs[1]].max])
            .range([0, target.height()]);
        let xAxis = d3.svg
            .axis()
            .scale(xAxisScale)
            .ticks(2)
            .orient("bottom");
        let yAxis = d3.svg
            .axis()
            .scale(yAxisScale)
            .ticks(2)
            .orient("left");
        const axisStyle = {
            'stroke': 'black',
            'fill': 'none',
            'stroke-width': '1px',
            "shape-rendering": "crispEdges",
            "font": "10px sans-serif",
            "font-weight": "normal"
        };

        svg
            .append("g")
            .attr("class", "shepard-diagram-x-axis")
            .attr("transform", "translate(0," + (target.height() - 20) + ")")
            .style(axisStyle)
            .call(xAxis);
        svg
            .append("g")
            .attr("class", "shepard-diagram-y-axis")
            .style(axisStyle)
            .call(yAxis);


    }

    resize()
    {

    }
}