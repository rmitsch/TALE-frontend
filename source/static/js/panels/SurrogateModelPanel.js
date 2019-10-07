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
        let scope = this;
        Utils.spawnChildDiv(this._target, null, "panel-info", "<span class='title'>" + scope._name + "</span>");

        // ------------------------------------------------------------
        // Add generator options.
        // ------------------------------------------------------------

        let optionsDiv          = Utils.spawnChildDiv(
            this._target,
            null,
            "surrogate-model-options-container"
        );
        let optionsDivElement   = $("#" + optionsDiv.id);

        Utils.spawnChildDiv(
            optionsDiv.id,
            "surrogate-model-generator-panel-label-generation-options",
            "surrogate-model-generator-panel-label",
            "Options for generation of surrogate model"
        );

        Utils.spawnChildDiv(
            optionsDiv.id,
            null,
            "surrogate-model-generator-option",
            "<span class='surrogate-model-generator-option-label'>Objective to explain: </span> " +
            "<div class='surrogate-model-generator-option-element'>" +
            "<select id='surrogate-settings-target-objective-select'>" +
            "  <option value='r_nx'>R<sub>nx</sub></option>" +
            "  <option value='runtime'>Runtime</option>" +
            "  <option value='stress'>Stress</option>" +
            "  <option value='classification_accuracy'>Target domain performance</option>" +
            "  <option value='separability_metric'>Separability</option>" +
            "</select>" +
            "</div>"
        );
        // Add event listener for change of target objective.
        const objectiveSelector = $("#surrogate-settings-target-objective-select");
        objectiveSelector.change(() => {
            this._operator.updateSurrogateModelChart(this._operator.filteredIDs, objectiveSelector.val())
        });

        let prioritiesList = Utils.spawnChildDiv(
            optionsDiv.id,
            null,
            "surrogate-model-generator-option",
            "<span class='surrogate-model-generator-option-label'>Optimization priorities:</span> " +
            "<div class='surrogate-model-generator-option-element'>" +
            "<ol id='surrogate-model-generation-priorities'>" +
            "<li><span class='ui-icon ui-icon-arrowthick-2-n-s'></span>Precision</li>" +
            "<li><span class='ui-icon ui-icon-arrowthick-2-n-s'></span>Recall</li>" +
            "<li><span class='ui-icon ui-icon-arrowthick-2-n-s'></span>F1</li>" +
            "<li><span class='ui-icon ui-icon-arrowthick-2-n-s'></span>Support</li>" +
            "<li><span class='ui-icon ui-icon-arrowthick-2-n-s'></span>Separability</li>" +
            "</ol>" +
            "</div>"
        );
        $("#surrogate-model-generation-priorities").sortable();

        Utils.spawnChildDiv(
            optionsDiv.id,
            null,
            "surrogate-model-generator-option",
            "<div class='surrogate-model-generator-option-label'>Maximal tree depth:</div> " +
            "<div class='surrogate-model-generator-option-element'>" +
            "<input class='numberInput' id='surrogate-model-generation-depth' type='number' value='5' min='1' step='1'/>" +
            "</div>"
        );

        Utils.spawnChildDiv(
            optionsDiv.id,
            null,
            "surrogate-model-generator-option",
            "<div class='surrogate-model-generator-option-label'>Maximal number of rules to use:</div> " +
            "<div class='surrogate-model-generator-option-element'>" +
            "<input class='numberInput' id='surrogate-model-generation-depth' type='number' value='100' min='1' step='1'/>" +
            "</div>"
        );

        let div         = document.createElement('button');
        div.id          = "surrogate-model-generator-button";
        div.className   = "pure-button pure-button-primary settings-update-button";
        div.innerHTML   = "Generate";
        optionsDivElement.append(div);
        optionsDivElement.append(document.createElement('hr'));

        // ------------------------------------------------------------
        // Add title and dropdown to table.
        // ------------------------------------------------------------

        let chartContainer  = Utils.spawnChildDiv(this._target, null, "surrogate-model-chart-container");

        Utils.spawnChildDiv(
            chartContainer.id,
            "surrogate-model-generator-panel-label-rules",
            "surrogate-model-generator-panel-label",
            "Decision Rules"
        );

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