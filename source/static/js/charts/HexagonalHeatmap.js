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
     * @param filteredRecordIDs
     * @param attributes List of length 2, containing identifiers of attributes to use for x- respectively y-axis.
     * @param style Various style settings (chart width/height, colors, ...). Arbitrary format, has to be parsed indivdually
     * by concrete classes.
     * @param parentDivID
     * @param dcGroup
     * @param internalCFDimension
     */
    constructor(
        name,
        panel,
        attributes,
        dataset,
        filteredRecordIDs,
        style,
        parentDivID,
        dcGroup,
        internalCFDimension
    )
    {
        super(name, panel, attributes, dataset, style, parentDivID);

        this._filteredRecordIDs     = {
            external: filteredRecordIDs,
            internal: filteredRecordIDs
        };
        this._internalCFDimension   = internalCFDimension;

        this._parentDivID       = parentDivID;
        this._svg               = null;
        this._colors            = null;
        this._brushExtent       = null;
        // Used to store max. value in heatmap cell - important for setting color of cells.
        this._maxCellValue      = null;

        // Update involved CSS classes.
        $("#" + this._target).addClass("hexagonal-heatmap");

        // Construct heatmap.
        this.constructCFChart();

        // Register chart in dc.js crossfilter-based update mechanism.
        dc.chartRegistry.register(this, dcGroup);
    }

    _reset()
    {
        $("#" + this._target).empty();
    }

    render()
    {
        this._reset();
        this.constructCFChart();
    }

    /**
     * Resets brush.
     * For compatibility with dc.js interface.
     */
    filterAll()
    {
        this._reset();
        this.constructCFChart();
    }

    /**
     * Redraws chart after change in set of filtered IDs.
     * For compatibility with dc.js interface.
     */
    redraw()
    {
        this._reset();
        this._filteredRecordIDs.external = this._panel._operator._dataset.getCurrentlyFilteredPairwiseDisplacmentRecordIDs(
            this._panel.currentShepardDiagramDistanceMetric,
            null
        );
        this.constructCFChart();
    }

    /**
     * Normalizes record values w.r.t. to chart extent.
     * @param attrs
     * @param chartWidth
     * @param chartHeight
     * @returns {{normalizedRecords: *, extrema: *}}
     * @private
     */
    _normalizeRecords(attrs, chartWidth, chartHeight)
    {
        let extrema = {
            [attrs[0]]: {max: -Infinity, min: 0},
            [attrs[1]]: {max: -Infinity, min: 0}
        };

        let records = [];
        for (const record of this._dataset) {
            records.push([record[attrs[0]], record[attrs[1]], record.source, record.neighbour]);

            for (let attr of attrs) {
                if (extrema[attr].max < record[attr])
                    extrema[attr].max = record[attr];
            }
        }

        return {
            extrema: extrema,
            normalizedRecords: records.map(record => ([
                chartWidth * record[0] / extrema[attrs[0]].max,
                chartHeight * record[1] / extrema[attrs[1]].max,
                record[2],
                record[3]
            ]))
        };
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

        const normalizationResults          = this._normalizeRecords(attrs, chartWidth, chartHeight);
        const extrema                       = normalizationResults.extrema;

        // --------------------------------------
        // 2. Bin records.
        // --------------------------------------

        // Bin records.
        let hexbin  = d3.hexbin()
            .extent([[-margin.left, -margin.top], [chartWidth + margin.right, chartHeight + margin.bottom]])
            .radius(radius);
        let bins    = hexbin(normalizationResults.normalizedRecords);

        // Find cell content extrema.
        const maxElemCount = Math.max(...bins.map(bin => bin.length));

        // --------------------------------------
        // 3. Append/reset SVG to container div.
        // --------------------------------------

        // Define color range.
        this._colors = d3
            .scaleLinear()
            .domain([0, Math.log2(maxElemCount)])
            .range(["#fff7fb", "#1f77b4"]);

        // Draw heatmap.
        this._svg = d3.select("#" + chartDiv.id).select("svg");
        if (!this._svg.empty())
            this._svg.remove();
        // Append SVG.
        this._svg = d3.select("#" + chartDiv.id).append("svg")
            .attr("width", chartWidth + margin.left + margin.right)
            .attr("height", chartHeight + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .style("stroke", "none");

        // --------------------------------------
        // 4. Draw heatmap.
        // --------------------------------------

        this._svg.append("g")
            .attr("class", "hexagons")
            .selectAll("path")
            .data(bins)
            .enter().append("path")
            .attr("d", hexbin.hexagon())
            .attr("transform", d => "translate(" + d.x + "," + d.y + ")")
            .style("fill", d => this._computeColorForHexBin(this._colors, d));

        // --------------------------------------
        // 5. Draw axes.
        // --------------------------------------

        const axesScales = this._drawAxes(targetElem, attrs, extrema, axesDiv);

        // --------------------------------------
        // 6. Add brush.
        // --------------------------------------

        this._addBrush(this._svg, axesScales.xAxisScale, axesScales.yAxisScale, this._colors);
    }

    /**
     * Draw axes for hex heatmap.
     * @param targetElem
     * @param attrs
     * @param extrema
     * @param axesDiv
     * @returns {{xAxisScale: *, yAxisScale: *}}
     * @private
     */
    _drawAxes(targetElem, attrs, extrema, axesDiv)
    {
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

        return {
            xAxisScale: xAxisScale,
            yAxisScale: yAxisScale
        }
    }

    /**
     * Computes color for hex bin w.r.t. set of currently selected records.
     * @param colors
     * @param binData
     * @returns {*}
     * @private
     */
    _computeColorForHexBin(colors, binData)
    {
        const filteredDataLength = binData.filter(record =>
            this._filteredRecordIDs.external.has(record[2]) &&
            this._filteredRecordIDs.external.has(record[3]) &&
            this._filteredRecordIDs.internal.has(record[2]) &&
            this._filteredRecordIDs.internal.has(record[3])
        ).length;

        return filteredDataLength > 0 ? colors(Math.log2(filteredDataLength)) : "#ccc";
    }

    /**
     * Updates set of filtered record IDs and cell colors with new record IDs.
     * @param filteredRecordIDs
     */
    updateFilteredRecords(filteredRecordIDs)
    {
        this._filteredRecordIDs.external = filteredRecordIDs;
        this._svg.selectAll("path").style("fill", d => this._computeColorForHexBin(this._colors, d));
    }

    /**
     * Add brush to hexagonal heatmap.
     * @param svg
     * @param xAxisScale
     * @param yAxisScale
     * @param colors
     * @private
     */
    _addBrush(svg, xAxisScale, yAxisScale, colors)
    {
        let instance    = this;
        const attrs     = this._attributes;

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
            instance._brushExtent   = brush.extent();
            const extent            = instance._brushExtent;
            let paths               = instance._svg.selectAll("path");

            // todo remember IDs filtered _in_ hex heatmap and _outside_ hex heatmap - restore should only affect those
            //  filtered _in_ hex heatmap.

            // If extent is one point only: Reset.
            if (extent[0][0] === extent[1][0] && extent[0][1] === extent[1][1]) {
                // Reset state of internal filter set.
                instance._filteredRecordIDs.internal = new Set(
                    instance._dataset.flatMap(record => [record.source, record.neighbour])
                );

                // Color cells.
                paths.style("fill", d => instance._computeColorForHexBin(instance._colors, d));
            }

            // Color hexagons, filter records w.r.t. brush extent.
            else {
                paths
                    .style("fill", d => valuesInBrush(
                        extent, xAxisScale.invert(d.x), yAxisScale.invert(d.y)
                    ) ? instance._computeColorForHexBin(instance._colors, d) : "#ccc");

                // Update selection of filtered points.
                instance._filteredRecordIDs.internal = new Set(
                    instance._dataset
                        .filter(record => valuesInBrush(extent, record[attrs[0]], record[attrs[1]]))
                        .flatMap(record => [record.source, record.neighbour])
                );
            }

            // Filter dimension reflecting chart state.
            instance._internalCFDimension.filter(d => instance._filteredRecordIDs.internal.has(d));

            // Propagate filteredRecordIDs to other charts.
            instance._panel.updateFilteredRecordBuffer(instance._name, new Set(
                [...instance._filteredRecordIDs.internal].filter(x => instance._filteredRecordIDs.external.has(x)))
            );
        }

        this._svg
            .append("g")
            .attr("class", "brush")
            .attr("transform", "translate(-5, -5)")
            .call(brush);

        // Restore brush/internal filter state, if available.
        if (instance._brushExtent !== null) {
            brush.extent(instance._brushExtent);
            brush(instance._svg.select(".brush"));
            brush.event(instance._svg.select(".brush"));
        }
    }

    resize()
    {
    }
}