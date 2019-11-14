import Operator from "./Operator.js";
import FilterReduceChartsPanel from "../panels/FilterReduceChartsPanel.js";
import FilterReduceTablePanel from "../panels/FilterReduceTablePanel.js";
import FilterReduceSettingsPanel from "../panels/settings/FilterReduceSettingsPanel.js";

/**
 * Class for FilterReduceOperators with scattered (scree) and violin plots.
 * One operator operates on exactly one dataset (-> one instance of class DRMetaDataset).
 */
export default class FilterReduceOperator extends Operator
{
    /**
     * Constructs new FilterReduceOperator.
     * Note that FilterReduceOperator is invariant towards which kernel was used for dimensionality reduction, since all
     * hyperparameter/objectives are defined in metadata. Thus, the specific operator name ("FilterReduce:TSNE") is
     * stored in a class attribute only (as opposed to branching the Operator class tree further).
     * @param name
     * @param stage
     * @param dataset Instance of DRMetaDataset class.
     * @param embeddingsRatingsData
     * @param parentDivID
     * @param pointwiseQualityData
     * @param tableParentDivID ID of parent div for embedding overview table.
     */
    constructor(name, stage, dataset, embeddingsRatingsData, pointwiseQualityData, parentDivID, tableParentDivID)
    {
        super(name, stage, "1", "n", dataset, parentDivID);

        this._pointwiseQualityData  = pointwiseQualityData;
        this._embeddingsRatingsData = embeddingsRatingsData;

        // Update involved CSS classes.
        $("#" + this._target).addClass("filter-reduce-operator");

        // Store ID of parent table div.
        this._tableParentDivID = tableParentDivID;

        // Construct all necessary panels.
        this.constructPanels();


        // Add listener for rating updates.
        const chartPanel    = this._panels["Parameter Space"];
        const tablePanel    = this._panels["Model Selection"];
        this._embeddingsRatingsData.addListener(chartPanel._name, chartPanel, chartPanel.updateRatingsHistogram);
        this._embeddingsRatingsData.addListener(tablePanel._name, tablePanel, tablePanel.updateRatingsHistogram);
    }

    /**
     * Constructs all panels required by this operator.
     */
    constructPanels()
    {
        // ----------------------------------------------
        // Generate panels.
        // ----------------------------------------------

        // 1. Construct panel for selection table.
        let tablePanel = new FilterReduceTablePanel(
            "Model Selection",
            this,
            this._tableParentDivID
        );
        this._panels[tablePanel.name] = tablePanel;

        // 2. Construct panels for charts.
        let frcPanel = new FilterReduceChartsPanel(
            "Parameter Space",
            this
        );
        this._panels[frcPanel.name] = frcPanel;

        // 3. Construct panel for settings.
        let settingsPanel = new FilterReduceSettingsPanel(
            "Parameter Space: Settings",
            this,
            null,
            "filter-reduce-info-settings-icon"
        );
        this._panels[settingsPanel.name] = settingsPanel;
    }

    get tablePanel()
    {
        return this._panels["Model Selection"];
    }

    get pointwiseQualityData()
    {
        return this._pointwiseQualityData;
    }

    resize()
    {
        for (let panelName in this._panels) {
            this._panels[panelName].resize();
        }
    }

    render()
    {
        for (let panelName in this._panels) {
            this._panels[panelName].render();
        }
    }

    propagateSettingsChanges(config, sourcePanelName)
    {
        // We know that currently only one panel is affected by setting changes.
        // Otherwise changes would have to be propagated as done in parent method.
        this._panels["Parameter Space"].options = config;
    }

    filter(embeddingIDs)
    {
        this._panels["Parameter Space"].updateFilteredRecordBuffer(embeddingIDs);

        // Assuming dimensions have already been filtered.
        // for (let panelName in this._panels) {
        //     this._panels[panelName].render();
        // }
    }
}