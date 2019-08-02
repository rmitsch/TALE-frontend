import Chart from "./Chart.js";
import Utils from "../Utils.js"


/**
 * Creates chart for surrogate model.
 * Supported so far: Decision tree.
 * Code for tree: https://bl.ocks.org/ajschumacher/65eda1df2b0dd2cf616f.
 * Alternative: http://bl.ocks.org/pprett/3813537.
 */
export default class SurrogateModelChart extends Chart
{
    /**
     *
     * @param name
     * @param panel
     * @param attributes Ignored.
     * @param dataset
     * @param style
     * @param parentDivID
     */
    constructor(name, panel, attributes, dataset, style, parentDivID)
    {
        super(name, panel, attributes, dataset, style, parentDivID);

        // Construct graph.
        this.constructCFChart();
    }

    /**
     * Construction happens at rendering time.
     */
    constructCFChart()
    {
    }

    /**
     * Resets canvas and updates dataset.
     * @param dataset
     */
    reset(dataset)
    {
        this._dataset = dataset;
        // Remove SVG.
        d3.select("#surrogate-model-chart-svg").remove();
    }

    /**
     * Constructs and draws chart drawing decision tree.
     * Source: https://bl.ocks.org/ajschumacher/65eda1df2b0dd2cf616f.
     */
    render()
    {
    }

    resize()
    {
        let operatorDiv = $("#" + this._panel._operator._target);

        // Check if panel height has changed.
        if (operatorDiv.height() !== this._lastPanelSize.height) {
            this.render();
        }
    }

     /**
      * Create (hardcoded) div structure for child nodes.
      * @deprecated
      * @returns {Object}
     */
    _createDivStructure()
    {
        // -----------------------------------
        // Create charts container.
        // -----------------------------------

        let chartDiv = Utils.spawnChildDiv(this._target, null, "surrogate-model-chart");

        return {
            chartDivID: chartDiv.id
        };
    }
}