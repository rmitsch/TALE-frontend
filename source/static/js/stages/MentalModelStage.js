import Stage from './Stage.js'
import SurrogateModelGeneratorOperator from "../operators/SurrogateModelGeneratorOperator.js";
import SurrogateModelViewerOperator from "../operators/SurrogateModelViewerOperator.js";

/**
 * Stage for exploration.
 */
export default class MentalModelStage extends Stage
{
    /**
     *
     * @param name
     * @param target ID of container div.
     * @param datasets Dictionary of isnstance of dataset class.
     */
    constructor(name, target, datasets)
    {
        super(name, target, datasets);

        this._splitPane = null;

        // Construct operators.
        this.constructOperators();
    }


    /**
     * Construct all panels for this view.
     */
    constructOperators()
    {
        this._operators["generator"] = new SurrogateModelGeneratorOperator(
            "SurrogateModelGenerator", this, this._datasets.modelMetadata
        );
        this._operators["viewer"] = new SurrogateModelViewerOperator(
            "SurrogateModelViewer", this, this._datasets.modelMetadata
        );

        // ---------------------------------------------------------
        // Initialize split panes.
        // ---------------------------------------------------------

        const generatorPanelID  = this._operators.generator._target;
        const viewerPanelID     = this._operators.viewer._target;

        $("#" + generatorPanelID).addClass("split split-horizontal");
        $("#" + viewerPanelID).addClass("split split-horizontal");
        this._splitPane = Split(
            ["#" + generatorPanelID, "#" + viewerPanelID],
            {
                direction: "horizontal",
                sizes: [35, 65],
                minSize: 0,
                snapOffset: 0,
                onDragEnd: function() {
                }
            }
        );
    }

    filter(source, embeddingIDs)
    {
    }

    get shiftDown()
    {
        return this._shiftDown;
    }

    get ctrlDown()
    {
        return this._ctrlDown;
    }

    get keyEventCallbacks()
    {
        return this._keyEventCallbacks;
    }
}