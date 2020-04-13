import Utils from "../Utils.js";
import Operator from "./Operator.js";
import SurrogateModelPanel from "../panels/SurrogateModelPanel.js";
import SurrogateModelSettingsPanel from "../panels/settings/SurrogateModelSettingsPanel.js";
import SurrogateModelDataset from "../data/SurrogateModelDataset.js";

export default class SurrogateModelGeneratorOperator extends Operator {
    /**
     *
     * @param name
     * @param stage
     * @param explainerData
     * @param embeddingsMetadata
     * @param parentDivID
     */
    constructor(name, stage, explainerData, embeddingsMetadata, parentDivID)
    {
        super(name, stage, "1", "0", explainerData, parentDivID);
        this._embeddingsMetadata = embeddingsMetadata;

        // Update involved CSS classes.
        $("#" + this._target).addClass("surrogate-model-generator-operator");

        // Initialize _filteredIDsGlobal with all available IDs.
        for (let record of this._embeddingsMetadata._data)
            this._filteredIDs.add(record.id);

        // Construct all necessary panels.
        this._panelName = "Surrogate Model Generation";
        this.constructPanels();
    }

    constructPanels()
    {
        this._panels[this._panelName] = new SurrogateModelPanel(this._panelName, this);
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
     * @param objective
     */
    updateSurrogateModelChart(filteredIDs, objective)
    {
        let scope           = this;
        let cursorTarget    = $("html");
        let idString        = "";

        cursorTarget.css("cursor", "wait");

        for (let id of filteredIDs)
            idString += id + ",";
        idString = idString.substring(0, idString.length - 1);

        // Request new dataset, apply changes.
        fetch(
            "/get_surrogate_model_data?modeltype=rules&objs=" + objective +
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
                scope._panels[scope._panelName].processSettingsChange(
                    new SurrogateModelDataset("Surrogate Model Dataset", values, scope._embeddingsMetadata)
                );
                cursorTarget.css("cursor", "default");
            }
        );
    }
}