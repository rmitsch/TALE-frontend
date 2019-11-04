import Stage from './Stage.js'
import FilterReduceOperator from "../operators/FilterReduceOperator.js";
import Utils from "../Utils.js";
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

        // Fetch data.
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
        Promise.all([explainerDataJSON, pointwiseQualityData])
            .then(function(values) {
                logField.text("Compiling ExplainerDataset");
                console.log("Compiling ExplainerDataset.");
                scope._datasets["explainer"]       = new ExplainerDataset("ExplainerDataset", values[0]);

                // Spawn container for panels at bottom.
                let splitLeftDiv    = Utils.spawnChildDiv(scope._target, null, "split-left-container");
                let splitTopDiv     = Utils.spawnChildDiv(splitLeftDiv.id, null, "split-top-container");
                // Spawn container for panels at bottom. Used for surrogate and dissonance panel.
                let splitBottomDiv  = Utils.spawnChildDiv(splitLeftDiv.id, null, "split-bottom-container");
                // Spawn container for model detail to the right.
                // let splitRightDiv  = Utils.spawnChildDiv(scope._target, null, "split-right-container");

                //---------------------------------------------------------
                // Operator for hyperparameter and objective selection.
                // ---------------------------------------------------------

                scope._operators["FilterReduce"] = new FilterReduceOperator(
                    "FilterReduce:TSNE",
                    scope,
                    scope._datasets["modelMetadata"],
                    values[1],
                    splitTopDiv.id,
                    splitBottomDiv.id
                );

                // ---------------------------------------------------------
                // Operator for exploration of explainer values.
                // ---------------------------------------------------------

                scope._operators["Explainer"] = new ExplainerOperator(
                    "Explainer",
                    scope,
                    scope._datasets["explainer"],
                    splitBottomDiv.id
                );

                // ---------------------------------------------------------
                // Operator for model (+ sample) detail view.
                // ---------------------------------------------------------

                scope._operators["ModelDetail"] = new ModelDetailOperator(
                    "Detail:DRModel",
                    scope,
                    scope._datasets["modelMetadata"],
                    scope._target
                );

                // ---------------------------------------------------------
                // Initialize split panes.
                // ---------------------------------------------------------

                let explainerTarget         = scope._operators["Explainer"]._target;
                let embeddingsTableTarget   = scope._operators["FilterReduce"].tablePanel._target;

                // Horizontal split right.
                // $("#" + splitLeftDiv.id).addClass("split split-horizontal");
                // $("#" + splitRightDiv.id).addClass("split split-horizontal");
                // Split(
                //     ["#" + splitLeftDiv.id, "#" + splitRightDiv.id],
                //     {
                //         direction: "horizontal",
                //         sizes: [99.5, 0],
                //         minSize: 0,
                //         snapOffset: 0,
                //         onDragEnd: function() {
                //             scope._operators["Explainer"].resize();
                //             scope._operators["ModelDetail"].resize();
                //         }
                //     }
                // );

                // Horizontal split left.
                $("#" + explainerTarget).addClass("split split-horizontal");
                $("#" + embeddingsTableTarget).addClass("split split-horizontal");
                scope._bottomSplitPane = Split(
                    ["#" + embeddingsTableTarget, "#" + explainerTarget],
                    {
                        direction: "horizontal",
                        sizes: [65, 35],
                        minSize: 0,
                        snapOffset: 0,
                        onDragEnd: function() {
                            scope._operators["FilterReduce"].resize();
                            scope._operators["Explainer"].resize();
                        }
                    }
                );

                // Vertical split left.
                $("#" + splitTopDiv.id).addClass("split split-vertical");
                $("#" + splitBottomDiv.id).addClass("split split-vertical");
                Split(
                    ["#" + splitTopDiv.id, "#" + splitBottomDiv.id],
                    {
                        direction: "vertical",
                        sizes: [52, 48],
                        minSize: [0.45 * $(document).height(), 10],
                        onDragEnd: function() {
                            scope._operators["FilterReduce"].resize();
                            scope._operators["Explainer"].resize();
                        }
                    }
                );

                // After split: Render (resize-sensitive) components.
                scope._operators["Explainer"].resize();
                scope._operators["FilterReduce"].resize();
                // scope._operators["ModelDetail"].resize();
                $("#" + embeddingsTableTarget + " .dataTables_scrollBody").css(
                    'height', ($("#" + splitBottomDiv.id).height() - 190) + "px"
                );

                // ---------------------------------------------------------
                // Fade out splash screen, fade in stage.
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

    activate()
    {
    }

    deactivate()
    {
    }
}