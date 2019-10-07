import Panel from "./Panel.js";
import Utils from "../Utils.js";
import Dataset from "../data/DRMetaDataset.js";
import SurrogateModelChart from "../charts/SurrogateModelChart.js"


/**
 * Panel holding charts for surrogate model in SurrogateModelOperator.
 */
export default class SurrogateModelPanel extends Panel
{
    /**
     * Constructs new FilterReduce charts panel.
     * Note that no active CF interaction happens in this panel - it's read only.
     * @param name
     * @param operator
     * @param parentDivID
     */
    constructor(name, operator, parentDivID)
    {
        super(name, operator, parentDivID);

        this._chart = null;

        // Update involved CSS classes.
        $("#" + this._target).addClass("surrogate-model-panel");

        // Create div structure for child nodes.
        this._divStructure = this._createDivStructure();

        // Generate charts.
        this._generateCharts();
    }

    /**
     * Generates all chart objects. Does _not_ render them.
     */
    _generateCharts()
    {
        console.log("Generating SurrogateModelPanel...");
        $("#logField").text("Generating SurrogateModelPanel...");

        // Initialize chart.
        this._chart = new SurrogateModelChart(
            "Surrogate Model Chart",
            this,
            null,
            this._operator._dataset,
            {
                relativeTableHeight: 0.5
            },
            this._divStructure.chartContainerID
        );
    }

    /**
     * Create (hardcoded) div structure for child nodes.
     * @returns {Object}
     * @private
     */
    _createDivStructure()
    {
        let scope           = this;
        let chartContainer  = Utils.spawnChildDiv(this._target, null, "surrogate-model-chart-container");
        let infoDiv         = Utils.spawnChildDiv(this._target, null, "panel-info", "<span class='title'>" + scope._name + "</span>");
        // $("#" + infoDiv.id).html("<span class='title'>" + scope._name + "</span>");

        let rulesTitleLabel = Utils.spawnChildDiv(
            this._target,
            "surrogate-model-generator-panel-label-rules",
            "surrogate-model-generator-panel-label",
            "Decision Rules" +
            "<select id='surrogate-settings-target-objective-select'>" +
            "  <option value='r_nx'>R<sub>nx</sub></option>" +
            "  <option value='runtime'>Runtime</option>" +
            "  <option value='stress'>Stress</option>" +
            "  <option value='classification_accuracy'>Target domain performance</option>" +
            "  <option value='separability_metric'>Separability</option>" +
            "</select>"
        );
        const objectiveSelector = $("#surrogate-settings-target-objective-select");

        objectiveSelector.change(() => {
            this._operator.updateSurrogateModelChart(this._operator.filteredIDs, objectiveSelector.val())
        });

        return {
            chartContainerID: chartContainer.id
        };
    }

    render()
    {
        this._chart.render();
    }

    resize()
    {
        this._chart.resize();
    }

    processSettingsChange(delta)
    {
        this._chart.reset(delta);
        this._chart.render();
    }
}