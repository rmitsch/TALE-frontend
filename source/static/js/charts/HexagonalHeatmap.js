import Scatterplot from "./Scatterplot.js";
import Utils from "../Utils.js";
import DRMetaDataset from "../data/DRMetaDataset.js";

/**
 * Hexagonal heatmap, without all the other extra stuff included in ParetoScatterplot, like correlation bars and
 * scatterplot options. Also looser coupled to data.
 * Ideally this should be a mix-in or at least totally flexibly coupled; time constraints enforce this approach.
 */
export default class HexagonalHeatmap extends Scatterplot
{
    /**
     * Instantiates new HexagonalHeatmap.
     * @param name
     * @param panel
     * @param dataset Expects dataset of Type as list of dicts with a set of properties including id, x, y. Other
     * properties are not mandatory.
     * @param style Various style settings (chart width/height, colors, ...). Arbitrary format, has to be parsed indivdually
     * by concrete classes.
     * @param parentDivID
     */
    constructor(name, panel, dataset, style, parentDivID)
    {
        super(name, panel, ["x", "y"], dataset, style, parentDivID, true);

        // Used to store max. value in heatmap cell - important for setting color of cells.
        this._maxCellValue = null;

        // Update involved CSS classes.
        $("#" + this._target).addClass("hexagonal-heatmap");
    }

    render()
    {
        throw new TypeError("HexagonalHeatmap.render(): Not implemented yet.");
    }

    constructCFChart()
    {

    }
}