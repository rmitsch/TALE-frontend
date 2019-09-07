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
         this._colorRange   = ["#fff7fb", "#1f77b4"];
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
     * Computes color for bin w.r.t. set of currently selected records.
     * @param colors
     * @param binData Collection of connections between points for pairwise displacement data.
     * @param index1
     * @param index2
     * @returns {string} Color for this bin.
     * @private
     */
    _computeColorForBin(colors, binData, index1, index2)
    {
        const filteredDataLength = binData.filter(record =>
            this._filteredRecordIDs.external.has(record[index1]) &&
            this._filteredRecordIDs.external.has(record[index2]) &&
            this._filteredRecordIDs.internal.has(record[index1]) &&
            this._filteredRecordIDs.internal.has(record[index2])
        ).length;

        return filteredDataLength > 0 ? colors((filteredDataLength)) : "#fff";
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

    /**
     * Generates (or replaces, if it exists) SVG.
     * @param chartDivID
     * @param chartWidth
     * @param chartHeight
     * @param margin
     * @returns Generated SVG element.
     * @private
     */
    _generateEmptySVG(chartDivID, chartWidth, chartHeight, margin)
    {
        let svg = d3.select("#" + chartDivID).select("svg");
        if (svg.empty())
            svg.remove();

        // Append SVG.
        svg = d3
            .select("#" + chartDivID)
            .append("svg")
            .attr("width", chartWidth + margin.left + margin.right)
            .attr("height", chartHeight + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .style("stroke", "none");

        return svg;
    }

    resize()
    {
    }
}