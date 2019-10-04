import Utils from "../Utils.js";
import Operator from "./Operator.js";

export default class SurrogateModelGeneratorOperator extends Operator {
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
        $("#" + this._target).addClass("surrogate-model-generator-operator");

        // Construct all necessary panels.
        this.constructPanels();
    }

    constructPanels()
    {
        this._panels["panel"] = Utils.spawnChildDiv(
            this._target, null, "surrogate-model-generator-panel"
        );
    }
}