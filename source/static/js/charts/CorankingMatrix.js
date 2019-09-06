import Utils from "../Utils.js";
import ModelDetailHeatmap from "./ModelDetailHeatmap.js";

/**
 * Hexagonal heatmap.
 * Currently to be re-created in case of a filter change, no iterative delta processing supported.
 * Note: Functionality for integration with crossfilter.js should be mixin, lack of time enforces this half-baked
 * approach.
 */
export default class CorankingMatrix extends ModelDetailHeatmap
{
    /**
     * Instantiates new CorankingMatrix.
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
     * @param nRecords Number of records in dataset.
     * @param nBins
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
        nRecords,
        nBins
    )
    {
        super(
            name,
            panel,
            attributes,
            dataset,
            filteredRecordIDs,
            style,
            parentDivID,
            dcGroupName,
            internalCFDimension,
            "coranking-matrix"
        );
        this._nRecords  = nRecords;
        this._nBins     = nBins;

        // Construct heatmap.
         this.constructCFChart();
        // Register chart in dc.js crossfilter-based update mechanism.
        dc.chartRegistry.register(this, dcGroupName);
    }

    constructCFChart()
    {
        // --------------------------------------
        // 0. Prepare div structure and
        // constants.
        // --------------------------------------

        let chartDiv        = Utils.spawnChildDiv(this._target, null, "model-detail-coranking-matrix-chart");
        let axesDiv         = Utils.spawnChildDiv(this._target, null, "model-detail-coranking-matrix-axes");

        let attrs           = this._attributes;
        const targetElem    = $("#" + this._target);
        const chartElem     = $("#" + chartDiv.id);
        const margin        = {top: 0, right: 1, bottom: 1, left: 0};
        const chartWidth    = chartElem.width() - margin.left - margin.right;
        const chartHeight   = chartElem.height() - margin.top - margin.bottom;

        // --------------------------------------
        // 1. Bin records.
        // --------------------------------------

        let bins            = this._dataset;
        // Find highest number of elements in bin.
        const maxElemCount  = Math.max(...bins.map(bin => bin.paths.length));
        
        // --------------------------------------
        // 2. Generate SVG.
        // --------------------------------------

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
        // 2. Build scales and axes.
        // --------------------------------------

        let labels = [];
        for (let i = 0; i < this._nBins; i++)
            labels.push(i);

        let x = d3.scaleBand()
            .range([0, chartWidth])
            .domain(labels)
            .padding(0);

        let y = d3.scaleBand()
            .range([0, chartHeight])
            .domain(labels)
            .padding(0);

        // Draw axes.
        const axesScales = this._drawAxes(
            targetElem,
            attrs,
            {[attrs[0]]: {min: 1, max: this._nRecords}, [attrs[1]]: {min: 1, max: this._nRecords}},
            axesDiv,
            25,
            20,
            "coranking-matrix"
        );

        // Define color range.
        this._colors = d3
            .scaleLinear()
            .domain([0, (maxElemCount)])
            .range(["#fff7fb", "#1f77b4"]);

        // --------------------------------------
        // 3. Draw heatmap.
        // --------------------------------------

        this._svg
            .attr("class", "coranking-bins")
            .selectAll()
            // .data(bins, d => d[attrs[0]] + ':' + d[attrs[1]])
            // .data(bins, function(d) {console.log("data:", d); return d;})
            .data(bins)
            .enter()
            .append("rect")
            .attr("x", d => x(d[attrs[0]]))
            // .attr("x", d => x(d[attrs[0]]))
            .attr("y", d => y(d[attrs[1]]))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .style("fill", d => this._computeColorForBin(this._colors, d));
    }

    _computeColorForBin(colors, binData)
    {
        const filteredDataLength = binData.paths.filter(record =>
            this._filteredRecordIDs.external.has(record[0]) &&
            this._filteredRecordIDs.external.has(record[1]) &&
            this._filteredRecordIDs.internal.has(record[0]) &&
            this._filteredRecordIDs.internal.has(record[1])
        ).length;

        return filteredDataLength > 0 ? colors((filteredDataLength)) : "#ccc";
    }

    // _drawAxes(targetElem, attrs, extrema, axesDiv)
    // {
    //     const targetDivHeight   = targetElem.height();
    //     const targetDivWidth    = targetElem.width();
    //
    //     let xAxisScale = d3.scale
    //         .linear()
    //         .domain([0, extrema[attrs[0]].max])
    //         .range([0, targetDivWidth - 0]);
    //     let yAxisScale = d3.scale
    //         .linear()
    //         .domain([0, extrema[attrs[1]].max])
    //         .range([targetDivHeight - 0, 0]);
    //     let xAxis = d3.svg
    //         .axis()
    //         .scale(xAxisScale)
    //         .ticks(3)
    //         .orient("bottom");
    //     let yAxis = d3.svg
    //         .axis()
    //         .scale(yAxisScale)
    //         .ticks(3)
    //         .orient("left");
    //     const axisStyle = {
    //         'stroke': 'black',
    //         'fill': 'none',
    //         'stroke-width': '1px',
    //         "shape-rendering": "crispEdges",
    //         "font": "10px sans-serif",
    //         "font-weight": "normal"
    //     };
    //
    //     let svgAxes = d3.select("#" + axesDiv.id)
    //         .append("svg")
    //         .attr("width", targetDivWidth)
    //         .attr("height", targetDivHeight);
    //
    //     svgAxes
    //         .append("g")
    //         .attr("class", "coranking-matrix-x-axis")
    //         .attr("transform", "translate(20, " + (targetDivHeight - 25) + ")")
    //         .style(axisStyle)
    //         .call(xAxis);
    //     svgAxes
    //         .append("g")
    //         .attr("class", "coranking-matrix-y-axis")
    //         .attr("transform", "translate(25, 0)")
    //         .style(axisStyle)
    //         .call(yAxis);
    //
    //     return {
    //         xAxisScale: xAxisScale,
    //         yAxisScale: yAxisScale
    //     }
    // }

    redraw()
    {
        this._reset();
        this._filteredRecordIDs.external = this._panel._operator._dataset.getCurrentlyFilteredPairwiseDisplacmentRecordIDs(
            this._panel.currentCorankingMatrixDistanceMetric,
            null
        );
        this.constructCFChart();
    }
}