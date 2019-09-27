import Operator from "./Operator.js";
import ExplainerPanel from "../panels/ExplainerPanel.js";
// import DissonanceSettingsPanel from "../panels/settings/DissonanceSettingsPanel.js";


/**
 * Class for explainer operators.
 * One operator operates on exactly one dataset (-> one instance of class DRMetaDataset).
 */
export default class ExplainerOperator extends Operator
{
    /*
     * Constructs new ExplainerOperator.
     * @param name
     * @param stage
     * @param dataset Instance of DRMetaDataset class.
     * @param parentDivID
     */
    constructor(name, stage, dataset, parentDivID)
    {
        super(name, stage, "1", "0", dataset, parentDivID);

        // Update involved CSS classes.
        $("#" + this._target).addClass("explainer-operator");

        // Construct all necessary panels.
        this.constructPanels();
    }

    /**
     * Constructs all panels required by this operator.
     */
    constructPanels()
    {
        // Construct panel for explainer heatmap.
        const explainerPanelName            = "Hyperparameter Influence";
        this._panels[explainerPanelName]    = new ExplainerPanel(explainerPanelName, this);
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
        this._dataset._cf_dimensions["embeddingID"].filter(id => embeddingIDs.has(id));
        this._panels["Explanations"].render();
    }
}