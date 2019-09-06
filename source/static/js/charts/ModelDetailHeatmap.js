import Chart from "./Chart.js";

/**
 * Auxiliary base class for complementary, not dc.js-based heatmap charts used in ModelDetailView.
 */
export default class ModelDetailHeatmap extends Chart
{
    /**
     * Initializes new ModelDetailHeatmap base.
     * @param name
     * @param panel
     * @param dataset Expects dataset of Type as list of dicts with a set of properties including id, x, y. Other
     * properties are not mandatory.
     * @param filteredRecordIDs
     * @param attributes List of length 2, containing identifiers of attributes to use for x- respectively y-axis.
     * @param style Various style settings (chart width/height, colors, ...). Arbitrary format, has to be parsed indivdually
     * by concrete classes.
     * @param parentDivID
     * @param dcGroupName
     * @param internalCFDimension
     * @param classNameToAdd
     */
     constructor(
        name,
        panel,
        attributes,
        dataset,
        filteredRecordIDs,
        style,
        parentDivID,
        dcGroupName,
        internalCFDimension,
        classNameToAdd
    ) {
         super(name, panel, attributes, dataset, style, parentDivID);

        // Make class abstract.
        if (new.target === ModelDetailHeatmap) {
            throw new TypeError("Cannot construct Chart instances.");
        }

        // Initialize internal state.
         this._filteredRecordIDs = {
             external: filteredRecordIDs,
             internal: filteredRecordIDs
         };
         this._internalCFDimension = internalCFDimension;

         this._parentDivID  = parentDivID;
         this._svg          = null;
         this._colors       = null;
         this._brushExtent  = null;
         // Used to store max. value in heatmap cell - important for setting color of cells.
         this._maxCellValue = null;

         // Update involved CSS classes.
         $("#" + this._target).addClass(classNameToAdd);
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
    redraw(distanceMetricName)
    {
        throw new TypeError("ModelDetailHeatmap.redraw(): Abstract method must not be called.");
    }

    constructCFChart()
    {
        throw new TypeError("ModelDetailHeatmap.constructCFChart(): Abstract method must not be called.");
    }

    /**
     * Computes color for hex bin w.r.t. set of currently selected records.
     * @param colors
     * @param binData
     * @returns {*}
     * @private
     */
    _computeColorForBin(colors, binData)
    {
        throw new TypeError("ModelDetailHeatmap._computeColorForBin(): Abstract method must not be called.");
    }

    /**
     * Updates set of filtered record IDs and cell colors with new record IDs.
     * @param filteredRecordIDs
     */
    updateFilteredRecords(filteredRecordIDs)
    {
        this._filteredRecordIDs.external = filteredRecordIDs;
        this._svg.selectAll("path").style("fill", d => this._computeColorForBin(this._colors, d));
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

            // If extent is one point only: Reset.
            if (extent[0][0] === extent[1][0] && extent[0][1] === extent[1][1]) {
                // Reset state of internal filter set.
                instance._filteredRecordIDs.internal = new Set(
                    instance._dataset.flatMap(record => [record.source, record.neighbour])
                );

                // Color cells.
                paths.style("fill", d => instance._computeColorForBin(instance._colors, d));
            }

            // Color hexagons, filter records w.r.t. brush extent.
            else {
                paths
                    .style("fill", d => valuesInBrush(
                        extent, xAxisScale.invert(d.x), yAxisScale.invert(d.y)
                    ) ? instance._computeColorForBin(instance._colors, d) : "#ccc");

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

    /**
     * Draws axes.
     * @param targetElem
     * @param attrs
     * @param extrema
     * @param axesDiv
     * @param offsetX
     * @param offsetY
     * @param cssClassPrefix
     * @param nTicksX
     * @param nTicksY
     * @returns {{xAxisScale: *, yAxisScale: *}}
     * @private
     */
    _drawAxes(targetElem, attrs, extrema, axesDiv, offsetX, offsetY, cssClassPrefix, nTicksX = 3, nTicksY = 3)
    {
        const targetDivHeight   = targetElem.height();
        const targetDivWidth    = targetElem.width();
        cssClassPrefix         += "-";

        let xAxisScale = d3.scale
            .linear()
            .domain([0, extrema[attrs[0]].max])
            .range([0, targetDivWidth - offsetX]);
        let yAxisScale = d3.scale
            .linear()
            .domain([0, extrema[attrs[1]].max])
            .range([targetDivHeight - offsetY, 0]);
        let xAxis = d3.svg
            .axis()
            .scale(xAxisScale)
            .ticks(nTicksX)
            .orient("bottom");
        let yAxis = d3.svg
            .axis()
            .scale(yAxisScale)
            .ticks(nTicksY)
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
            .attr("class", cssClassPrefix + "-x-axis")
            .attr("transform", "translate(" + offsetX + ", " + (targetDivHeight - offsetY) + ")")
            .style(axisStyle)
            .call(xAxis);
        svgAxes
            .append("g")
            .attr("class", cssClassPrefix + "coranking-matrix-y-axis")
            .attr("transform", "translate(" + offsetX + ", 0)")
            .style(axisStyle)
            .call(yAxis);

        return {
            xAxisScale: xAxisScale,
            yAxisScale: yAxisScale
        }
    }

    resize()
    {
    }
}