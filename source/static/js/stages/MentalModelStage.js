import Stage from './Stage.js'
import SurrogateModelGeneratorOperator from "../operators/SurrogateModelGeneratorOperator.js";
import SurrogateModelViewerOperator from "../operators/SurrogateModelViewerOperator.js";
import SurrogateModelDataset from "../data/SurrogateModelDataset.js";

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
        const scope = this;

        //---------------------------------------------------------
        // Fetch data.
        // ---------------------------------------------------------

        let surrModelJSON = fetch(
            "/get_surrogate_model_data?modeltype=rules&objs=r_nx&n_bins=5",
            {
                headers: { "Content-Type": "application/json; charset=utf-8"},
                method: "GET"
            }
        ).then(res => res.json());

        //---------------------------------------------------------
        // Initialize operators.
        // ---------------------------------------------------------

        Promise.all([surrModelJSON]).then(function(data) {
            scope._datasets["surrogateModel"]   = new SurrogateModelDataset(
                "Surrogate Model Dataset",
                data[0],
                scope._datasets["modelMetadata"]
            );

            scope._operators["generator"] = new SurrogateModelGeneratorOperator(
                "SurrogateModelGenerator", scope, scope._datasets.surrogateModel, scope._datasets.modelMetadata
            );
            scope._operators["viewer"] = new SurrogateModelViewerOperator(
                "SurrogateModelViewer", scope, scope._datasets.modelMetadata
            );

            // ---------------------------------------------------------
            // Initialize split panes.
            // ---------------------------------------------------------

            const generatorPanelID  = scope._operators.generator._target;
            const viewerPanelID     = scope._operators.viewer._target;

            $("#" + generatorPanelID).addClass("split split-horizontal");
            $("#" + viewerPanelID).addClass("split split-horizontal");
            scope._splitPane = Split(
                ["#" + generatorPanelID, "#" + viewerPanelID],
                {
                    direction: "horizontal",
                    sizes: [40, 60],
                    minSize: [100, 100],
                    snapOffset: 0,
                    onDragEnd: function() {
                        scope._operators.generator.resize();
                        scope._operators.viewer.resize();
                    }
                }
            );
        });
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

    activate()
    {
        this._operators.generator.resize();
        this._operators.viewer.resize();
    }

    deactivate()
    {
    }
}