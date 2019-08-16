import Operator from "./Operator.js";
import SurrogateModelPanel from "../panels/SurrogateModelPanel.js";
import SurrogateModelSettingsPanel from "../panels/settings/SurrogateModelSettingsPanel.js";
import Utils from "../Utils.js";
import SurrogateModelDataset from "../data/SurrogateModelDataset.js";


/**
 * Class for SurrogateModel operators.
 * One operator operates on exactly one dataset (-> one instance of class DRMetaDataset).
 * See https://bl.ocks.org/ajschumacher/65eda1df2b0dd2cf616f.
 */
export default class SurrogateModelOperator extends Operator
{
    /**
     * Constructs new SurrogateModelOperator.
     * Note that SurrogateModelOperators is invariant towards which kernel was used for dimensionality reduction, since
     * all hyperparameter/objectives are defined in metadata. Thus, the specific operator name ("SurrogateModel:Tree")
     * is stored in a class attribute only (as opposed to branching the Operator class tree further).
     * @param name
     * @param stage
     * @param dataset Instance of DRMetaDataset class.
     * @param modelType Type of model to be used as surrogate. Currently available: Decision tree.
     * @param parentDivID
     */
    constructor(name, stage, dataset, modelType, parentDivID)
    {
        // Relationship cardinality is 1:0, since one dataset is read and none is produced.
        super(name, stage, "1", "0", dataset, parentDivID);

        // Update involved CSS classes.
        $("#" + this._target).addClass("surrogate-model-operator");

        // Save which model (influences inference model and visualization)
        // should be used as surrogate - e. g. decision tree.
        this._modelType = modelType;

        // Initialize _filteredIDs with all available IDs.
        for (let record of stage._datasets["modelMetadata"]._data)
            this._filteredIDs.add(record.id);

        // Construct all necessary panels.
        this.constructPanels();
    }

    /**
     * Constructs all panels required by this operator.
     */
    constructPanels()
    {
        // ----------------------------------------------
        // Generate panels.
        // ----------------------------------------------

        // 1. Construct panel for surrogate model visualization.
        let surrModelPanel = new SurrogateModelPanel(
            "Global Surrogate Model",
            this
        );
        this._panels[surrModelPanel.name] = surrModelPanel;

        // 2. Construct panel for settings.
        let settingsPanel = new SurrogateModelSettingsPanel(
            "Global Surrogate Model: Settings", this, null, "surrogate-info-settings-icon"
        );
        this._panels[settingsPanel.name] = settingsPanel;
    }

    render()
    {
        for (let panelName in this._panels) {
            this._panels[panelName].render();
        }
    }

    resize()
    {
        for (let panelName in this._panels) {
            this._panels[panelName].resize();
        }
    }

    filter(embeddingIDs)
    {
        // Ignore if no change since last filter() call.
        if (!(Utils.compareSets(embeddingIDs, this._filteredIDs))) {
            this._filteredIDs = embeddingIDs;
            this.updateSurrogateModelChart(this._filteredIDs);
        }
    }

    /**
     * Updates surrogate model chart after settings or filter change.
     * @param filteredIDs
     */
    updateSurrogateModelChart(filteredIDs)
    {
        let instance        = this;
        let cursorTarget    = $("#" + this._panels["Global Surrogate Model"]._target);
        let idString        = "";
        let options         = SurrogateModelSettingsPanel.getOptionValues();
        // Fall back to current set of filtered embedding IDs, if none specified.
        filteredIDs         = filteredIDs === undefined ? this._filteredIDs : filteredIDs;

        cursorTarget.css("cursor", "wait");

        for (let id of filteredIDs)
            idString += id + ",";
        idString = idString.substring(0, idString.length - 1);

        // Request new dataset, apply changes.
        fetch(
            "/get_surrogate_model_data?modeltype=rules&objs=" + options.objective +
            "&n_bins=5&ids=" + idString,
            {
                headers: {"Content-Type": "application/json; charset=utf-8"},
                method: "GET"
            }
        ).then(
            res => res.json()
        ).then(
            function(values)
            {
                instance._panels["Global Surrogate Model"].processSettingsChange(
                    new SurrogateModelDataset(
                        "Surrogate Model Dataset", values, instance._stage._datasets["modelMetadata"]
                    )
                );
                cursorTarget.css("cursor", "default");
            }
        );
    }
}