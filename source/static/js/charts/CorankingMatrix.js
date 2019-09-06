import Utils from "../Utils.js";
import Chart from "./Chart.js";

/**
 * Hexagonal heatmap.
 * Currently to be re-created in case of a filter change, no iterative delta processing supported.
 * Note: Functionality for integration with crossfilter.js should be mixin, lack of time enforces this half-baked
 * approach.
 */
export default class CorankingMatrix extends Chart
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
        dc.chartRegistry.register(this, dcGroupName);
    }

    constructCFChart()
    {
        console.log("constructing coranking matrix");
    }
}