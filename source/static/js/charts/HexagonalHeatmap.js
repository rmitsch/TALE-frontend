import Utils from "../Utils.js";
import ModelDetailHeatmap from "./ModelDetailHeatmap.js";

/**
 * Hexagonal heatmap.
 * Currently to be re-created in case of a filter change, no iterative delta processing supported.
 * Note: Functionality for integration with crossfilter.js should be mixin, lack of time enforces this half-baked
 * approach.
 */
export default class HexagonalHeatmap extends ModelDetailHeatmap
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
     * @param dcGroupName
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
        dcGroupName,
        internalCFDimension
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
            "hexagonal-heatmap"
        );

        // Construct heatmap.
         this.constructCFChart();
        // Register chart in dc.js crossfilter-based update mechanism.
        dc.chartRegistry.register(this, dcGroupName);
    }

    redraw()
    {
        this._reset();
        this._filteredRecordIDs.external = this._panel._operator._dataset.getCurrentlyFilteredPairwiseDisplacmentRecordIDs(
            null
        );
        this.constructCFChart();
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
        let bins        = hexbin(normalizationResults.normalizedRecords);
        const dataExt   = this._filteredRecordIDs.external;
        const dataInt   = this._filteredRecordIDs.internal;
        // Find cell content extrema.
        const maxElemCount = Math.max(...bins.map(
            bin => bin.filter(
                record =>
                    dataExt.has(record[2]) && dataExt.has(record[3]) &&
                    dataInt.has(record[2]) && dataInt.has(record[3])
            ).length)
        );

        // --------------------------------------
        // 3. Append/reset SVG to container div.
        // --------------------------------------

        // Define color range.
        this._colors = d3
            .scaleLinear()
            .domain([0, (maxElemCount)])
            .range(this._colorRange);

        // Generate SVG.
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
            .style("fill", d => this._computeColorForBin(this._colors, d, 2, 3));

        // --------------------------------------
        // 5. Draw axes.
        // --------------------------------------

        const axesScales = this._drawAxes(targetElem, attrs, extrema, axesDiv, 25, 20, "shepard-diagram", 0, 0);

        // Generate axis labels.
        this._generateAxisLabels(axesDiv.id);
    }
}