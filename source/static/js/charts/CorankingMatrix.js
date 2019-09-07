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

        let bins        = this._dataset;
        const dataExt   = this._filteredRecordIDs.external;
        const dataInt   = this._filteredRecordIDs.internal;
        // Find highest number of filtered elements in bin.
        const maxElemCount  = Math.max(...bins.map(
            bin => bin.paths.filter(
                record =>
                    dataExt.has(record[0]) && dataExt.has(record[1]) &&
                    dataInt.has(record[0]) && dataInt.has(record[1])
            ).length)
        );
        
        // --------------------------------------
        // 2. Generate SVG.
        // --------------------------------------

        this._svg = this._generateEmptySVG(chartDiv.id, chartWidth, chartHeight, margin);

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
            .domain([0, maxElemCount])
            .range(this._colorRange);

        // --------------------------------------
        // 3. Draw heatmap.
        // --------------------------------------

        this._svg
            .attr("class", "coranking-bins")
            .selectAll()
            .data(bins)
            .enter()
            .append("rect")
            .attr("x", d => x(d[attrs[0]]))
            // .attr("x", d => x(d[attrs[0]]))
            .attr("y", d => y(d[attrs[1]]))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .style("fill", d => this._computeColorForBin(this._colors, d.paths, 0, 1));
    }

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