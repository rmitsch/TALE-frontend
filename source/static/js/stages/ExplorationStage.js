import Stage from './Stage.js'
import FilterReduceOperator from "../operators/FilterReduceOperator.js";
import SurrogateModelOperator from "../operators/SurrogateModelOperator.js";
import Utils from "../Utils.js";
import SurrogateModelDataset from "../data/SurrogateModelDataset.js"
import ModelDetailOperator from "../operators/ModelDetailOperator.js";
import ExplainerDataset from "../data/ExplainerDataset.js";
import ExplainerOperator from "../operators/ExplainerOperator.js";

/**
 * Stage for exploration.
 */
export default class ExplorationStage extends Stage
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

        // Store splitter instance for bottom div.
        this._bottomSplitPane   = null;

        // Construct operators.
        this.constructOperators();
    }


    /**
     * Construct all panels for this view.
     */
    constructOperators()
    {
        let scope       = this;
        const logField  = $("#logField");

        // Fetch (test) dataset for surrogate model first, then initialize panels.
        let surrModelJSON = fetch(
            "/get_surrogate_model_data?modeltype=rules&objs=r_nx&n_bins=5",
            {
                headers: { "Content-Type": "application/json; charset=utf-8"},
                method: "GET"
            }
        ).then(res => res.json());

        let explainerDataJSON = fetch(
            "/get_explainer_values",
            {
                headers: { "Content-Type": "application/json; charset=utf-8"},
                method: "GET"
            }
        ).then(res => res.json());

        let pointwiseQualityData = fetch(
            "/get_binned_pointwise_quality_data",
            {
                headers: { "Content-Type": "application/json; charset=utf-8"},
                method: "GET"
            }
        ).then(res => res.json());

        // Fetch data.
        Promise.all([surrModelJSON, explainerDataJSON, pointwiseQualityData])
            .then(function(values) {
                logField.text("Compiling SurrogateModelDataset");
                console.log("Compiling SurrogateModelDataset.");
                scope._datasets["surrogateModel"]   = new SurrogateModelDataset(
                    "Surrogate Model Dataset",
                    values[0],
                    scope._datasets["modelMetadata"]
                );

                logField.text("Compiling ExplainerDataset");
                console.log("Compiling ExplainerDataset.");
                scope._datasets["explainer"]       = new ExplainerDataset("ExplainerDataset", values[1]);

                // For panels at bottom: Spawn container.
                let splitTopDiv     = Utils.spawnChildDiv(scope._target, null, "split-top-container");
                // For panels at bottom: Spawn container. Used for surrogate and dissonance panel.
                let splitBottomDiv  = Utils.spawnChildDiv(scope._target, null, "split-bottom-container");

                //---------------------------------------------------------
                // 1. Operator for hyperparameter and objective selection.
                // ---------------------------------------------------------

                scope._operators["FilterReduce"] = new FilterReduceOperator(
                    "FilterReduce:TSNE",
                    scope,
                    scope._datasets["modelMetadata"],
                    values[2],
                    splitTopDiv.id,
                    splitBottomDiv.id
                );

                // ---------------------------------------------------------
                // 2. Operator for exploration of surrogate model (read-only).
                // ---------------------------------------------------------

                scope._operators["SurrogateModel"] = new SurrogateModelOperator(
                    "GlobalSurrogateModel:ExplanationRules",
                    scope,
                    scope._datasets["surrogateModel"],
                    "Rules",
                    splitBottomDiv.id
                );

                // ---------------------------------------------------------
                // 3. Operator for exploration of explainer values.
                // ---------------------------------------------------------

                scope._operators["Explainer"] = new ExplainerOperator(
                    "Explainer",
                    scope,
                    scope._datasets["explainer"],
                    splitBottomDiv.id
                );

                // ---------------------------------------------------------
                // 4. Operator for model (+ sample) detail view.
                // ---------------------------------------------------------

                scope._operators["ModelDetail"] = new ModelDetailOperator(
                    "Detail:DRModel",
                    scope,
                    scope._datasets["modelMetadata"],
                    // Note that MD view is currently a modal, hence it doesn't matter which parent div is used.
                    scope._target
                );

                // ---------------------------------------------------------
                // 5. Initialize split panes.
                // ---------------------------------------------------------

                let surrTarget              = scope._operators["SurrogateModel"]._target;
                let explainerTarget         = scope._operators["Explainer"]._target;
                let embeddingsTableTarget   = scope._operators["FilterReduce"].tablePanel._target;

                // Horizontal split.
                $("#" + surrTarget).addClass("split split-horizontal");
                $("#" + explainerTarget).addClass("split split-horizontal");
                $("#" + embeddingsTableTarget).addClass("split split-horizontal");
                scope._bottomSplitPane = Split(
                    ["#" + embeddingsTableTarget, "#" + surrTarget, "#" + explainerTarget],
                    {
                        direction: "horizontal",
                        sizes: [30, 45, 25],
                        minSize: 0,
                        snapOffset: 0,
                        onDragEnd: function() {
                            scope._operators["SurrogateModel"].resize();
                            scope._operators["FilterReduce"].resize();
                            scope._operators["Explainer"].resize();
                        }
                    }
                );

                // Vertical split.
                $("#" + splitTopDiv.id).addClass("split split-vertical");
                $("#" + splitBottomDiv.id).addClass("split split-vertical");
                Split(
                    ["#" + splitTopDiv.id, "#" + splitBottomDiv.id],
                    {
                        direction: "vertical",
                        sizes: [52, 48],
                        minSize: [0.45 * $(document).height(), 10],
                        onDragEnd: function() {
                            scope._operators["SurrogateModel"].resize();
                            scope._operators["FilterReduce"].resize();
                            scope._operators["Explainer"].resize();
                        }
                    }
                );

                // After split: Render (resize-sensitive) components.
                scope._operators["SurrogateModel"].render();
                scope._operators["Explainer"].resize();
                scope._operators["FilterReduce"].resize();
                $("#" + embeddingsTableTarget + " .dataTables_scrollBody").css(
                    'height', ($("#" + splitBottomDiv.id).height() - 190) + "px"
                );

                // ---------------------------------------------------------
                // 5. Fade out splash screen, fade in stage.
                // ---------------------------------------------------------

                  $("#exploration-stage").fadeTo(2000, 1.0);
                  $("#splashscreen").fadeTo(1000, 0, function() {
                      $("#splashscreen").css("display", "none");
                  });

                  const now = new Date();
                  console.log("*** DROP *** Finished construction at " + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds() + ".");
            });
    }

    filter(source, embeddingIDs)
    {
        // Temporary (?) workaround for operators that are _not_ supposed to propagate their filter changes to the base
        // dataset of embeddings across different dc chart groups.
        // E. g.: Explanation rules - we don't automatically won't to exclude embeddings just because we excluded filter
        // rules; also they don't use the same underlying ID structure.
        const isolatedOperators = new Set(["GlobalSurrogateModel:ExplanationRules"]);
        if (!isolatedOperators.has(source))
            for (let opKey in this._operators) {
                if (this._operators[opKey]._name !== source)
                    this._operators[opKey].filter(embeddingIDs);
            }
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