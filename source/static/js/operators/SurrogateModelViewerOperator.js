import Operator from "./Operator.js";
import Utils from "../Utils.js";

export default class SurrogateModelViewerOperator extends Operator {
    /**
     *
     * @param name
     * @param stage
     * @param dataset Instance of DRMetaDataset class.
     * @param parentDivID
     */
    constructor(name, stage, dataset, parentDivID) {
        // Relationship cardinality is 1:0, since one dataset is read and none is produced.
        super(name, stage, "1", "0", dataset, parentDivID);

        // Update involved CSS classes.
        $("#" + this._target).addClass("surrogate-model-viewer-operator");

        this._splits = {middle: null, right: null}

        // Construct all necessary panels.
        this.constructPanels();
    }

    constructPanels()
    {
        this._panels["vis"] = Utils.spawnChildDiv(
            this._target, null, "surrogate-model-viewer-vis-panel"
        );
        this._panels["models"] = Utils.spawnChildDiv(
            this._target, null, "surrogate-model-viewer-models-panel"
        );
        this._panels["modelsSuggestions"] = Utils.spawnChildDiv(
            this._panels.models.id, null, "surrogate-model-viewer-models-suggestions-panel"
        );
        this._panels["modelsSaved"] = Utils.spawnChildDiv(
            this._panels.models.id, null, "surrogate-model-viewer-models-saved-panel"
        );

        // ---------------------------------------------------------
        // Initialize split panes.
        // ---------------------------------------------------------

        const visPanelID                = this._panels.vis.id;
        const modelsPanelID             = this._panels.models.id;
        const modelsSuggestionsPanelID  = this._panels.modelsSuggestions.id;
        const modelsSavedPanelID        = this._panels.modelsSaved.id;

        $("#" + visPanelID).addClass("split split-horizontal");
        $("#" + modelsPanelID).addClass("split split-horizontal");
        this._splits.left = Split(
            ["#" + visPanelID, "#" + modelsPanelID],
            {
                direction: "horizontal",
                sizes: [35, 65],
                minSize: 0,
                snapOffset: 0,
                onDragEnd: function() {
                }
            }
        );

        $("#" + modelsSuggestionsPanelID).addClass("split split-vertical");
        $("#" + modelsSavedPanelID).addClass("split split-vertical");
        this._splits.right = Split(
            ["#" + modelsSuggestionsPanelID, "#" + modelsSavedPanelID],
            {
                direction: "vertical",
                sizes: [50, 50],
                minSize: 0,
                snapOffset: 0,
                onDragEnd: function() {
                }
            }
        );

    }
}