import Utils from "../Utils.js";
import DRMetaDataset from "../data/DRMetaDataset.js";
import Chart from "./Chart.js";

/**
 * Hexagonal heatmap.
 * Currently to be re-created in case of a filter change, no iterative delta processing supported.
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
        // --------------------------------------
        // 0. Prepare div structure and
        // constants.
        // --------------------------------------

        let chartDiv        = Utils.spawnChildDiv(this._target, null, "model-detail-hexagonal-heatmap-chart");
        let axesDiv         = Utils.spawnChildDiv(this._target, null, "model-detail-hexagonal-heatmap-axes");

        let attrs           = this._attributes;
        const targetElem    = $("#" + this._target);
        const chartElem     = $("#" + chartDiv.id);
        const radius        = 5;
        const margin        = {top: radius, right: radius + 5, bottom: radius + 5, left: radius};
        const chartWidth    = chartElem.width() - margin.left - margin.right;
        const chartHeight   = chartElem.height() - margin.top - margin.bottom;

        // --------------------------------------
        // 1. Transform records.
        // --------------------------------------

        let extrema = {
            [attrs[0]]: {max: -Infinity, min: 0},
            [attrs[1]]: {max: -Infinity, min: 0}
        };

        let records = [];
        for (const record of this._dataset) {
            records.push([record[attrs[0]], record[attrs[1]]]);
            for (let attr of attrs) {
                if (extrema[attr].max < record[attr])
                    extrema[attr].max = record[attr];
            }
        }
        let normalizedRecords = records.map(record => ([
            chartWidth * record[0] / extrema[attrs[0]].max,
            chartHeight * record[1] / extrema[attrs[1]].max
        ]));

        // --------------------------------------
        // 2. Bin records.
        // --------------------------------------

        // Bin records.
        let hexbin = d3.hexbin()
            .extent([[-margin.left, -margin.top], [chartWidth + margin.right, chartHeight + margin.bottom]])
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
            .domain([0, Math.log2(maxElemCount)])
            .range(["#fff7fb", "#1f77b4"]);

        // Draw heatmap.
        let svg = d3.select("#" + chartDiv.id).select("svg");
        if (!svg.empty())
            svg.remove();
        // Append SVG.
        svg = d3.select("#" + chartDiv.id).append("svg")
            .attr("width", chartWidth + margin.left + margin.right)
            .attr("height", chartHeight + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .style("stroke", "none");

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
            .style("fill", d => colors(Math.log2(d.length)));

        // --------------------------------------
        // 5. Draw axes.
        // --------------------------------------

        const targetDivHeight   = targetElem.height();
        const targetDivWidth    = targetElem.width();

        let xAxisScale = d3.scale
            .linear()
            .domain([0, extrema[attrs[0]].max])
            .range([0, targetDivWidth - 20]);
        let yAxisScale = d3.scale
            .linear()
            .domain([0, extrema[attrs[1]].max])
            .range([targetDivHeight - 20, 0]);
        let xAxis = d3.svg
            .axis()
            .scale(xAxisScale)
            .ticks(3)
            .orient("bottom");
        let yAxis = d3.svg
            .axis()
            .scale(yAxisScale)
            .ticks(3)
            .orient("left");
        const axisStyle = {
            'stroke': 'black',
            'fill': 'none',
            'stroke-width': '1px',
            "shape-rendering": "crispEdges",
            "font": "10px sans-serif",
            "font-weight": "normal"
        };

        let svgAxes = d3.select("#" + axesDiv.id)
            .append("svg")
            .attr("width", targetDivWidth)
            .attr("height", targetDivHeight);

        svgAxes
            .append("g")
            .attr("class", "shepard-diagram-x-axis")
            .attr("transform", "translate(20, " + (targetDivHeight - 20) + ")")
            .style(axisStyle)
            .call(xAxis);
        svgAxes
            .append("g")
            .attr("class", "shepard-diagram-y-axis")
            .attr("transform", "translate(20, 0)")
            .style(axisStyle)
            .call(yAxis);

        // --------------------------------------
        // 6. Add brush.
        // --------------------------------------

        this._addBrush(svg, xAxisScale, yAxisScale, colors);
    }

    _addBrush(svg, xAxisScale, yAxisScale, colors)
    {
        let instance = this;

        let brush = d3.svg
             .brush()
             .x(xAxisScale)
             .y(yAxisScale)
             .on("brushend", updateAfterBrush);

        /**
         * Checks whether value is contained in extent of brush.
         * @param brushExtent
         * @param x
         * @param y
         * @returns {boolean}
         */
        function valuesInBrush(brushExtent, x, y)
        {
            return (
                x >= brushExtent[0][0] &&
                x <= brushExtent[1][0] &&
                y >= brushExtent[0][1] &&
                y <= brushExtent[1][1]
            );
        }

        function updateAfterBrush()
        {
            const extent    = brush.extent();
            let paths       = svg.selectAll("path");

            // If extent is one point only: Reset.
            if (extent[0][0] === extent[1][0] && extent[0][1] === extent[1][1]) {
                paths.style("fill", d => colors(Math.log2(d.length)));
                let filteredRecords = instance._dataset.flatMap(record => [record.source, record.neighbour]);
            }

            // Color hexagons, filter records w.r.t. brush extent.
            else {
                paths
                    .style("fill", d => valuesInBrush(
                        extent, xAxisScale.invert(d.x), yAxisScale.invert(d.y)
                    ) ? colors(Math.log2(d.length)) : "#ccc");

                // Update selection of filtered points.
                let filteredRecordIDs = new Set(
                    instance._dataset
                        .filter(record => valuesInBrush(extent, record.high_dim_distance, record.low_dim_distance))
                        .flatMap(record => [record.source, record.neighbour])
                );
            }
            // todo propagate filteredRecordIDs to other charts (and vice versa).
        }

        svg
            .append("g")
            .attr("class", "brush")
            .attr("transform", "translate(-5, -5)")
            .call(brush);
    }

    resize()
    {

    }
}