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
                let splitRightDiv  = Utils.spawnChildDiv(scope._target, null, "split-right-container");

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
                    splitRightDiv.id
                );

                // ---------------------------------------------------------
                // Initialize split panes.
                // ---------------------------------------------------------

                let explainerTarget         = scope._operators["Explainer"]._target;
                let embeddingsTableTarget   = scope._operators["FilterReduce"].tablePanel._target;

                // Horizontal split right.
                $("#" + splitLeftDiv.id).addClass("split split-horizontal");
                $("#" + splitRightDiv.id).addClass("split split-horizontal");
                Split(
                    ["#" + splitLeftDiv.id, "#" + splitRightDiv.id],
                    {
                        direction: "horizontal",
                        sizes: [99.7, 0],
                        minSize: 0,
                        snapOffset: 0,
                        onDragEnd: function() {
                            scope._operators["FilterReduce"].resize();
                            scope._operators["Explainer"].resize();
                            scope._operators["ModelDetail"].resize();
                        }
                    }
                );

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
                $("#" + embeddingsTableTarget + " .dataTables_scrollBody").css(
                    'height', ($("#" + splitBottomDiv.id).height() - 190) + "px"
                );

                // ---------------------------------------------------------
                // Fade out splash screen, fade in stage.
                // ---------------------------------------------------------

                  $("#exploration-stage").fadeTo(2000, 1.0);
                    $("#splashscreen").fadeTo(1000, 0, function() {
                      $("#splashscreen").css("display", "none");

                      // Start introduction tour.
                        let intro = introJs();
                        intro.setOptions({
                            steps: [
                                {
                                    intro: "Welcome to DROP! This tour will guide you step-by-step through the application. " +
                                        "<br><br>The user interface is divided into 'panels', each serving a specific " +
                                        "purpose. Settings can be accessed by clicking the cogwheel in the top right " +
                                        "corner of a panel."
                                },
                                {
                                    element: "#datasetLink",
                                    intro: "Multiple datasets are offered. Select the dataset you want to investigate " +
                                        "here.",
                                    position: "left"
                                },
                                {
                                    element: "#drkernelLink",
                                    intro: "Multiple algorithms for dimensionality reduction are offered. Select the " +
                                        "dimensionality reduction method you want to investigate here.",
                                    position: "left"
                                },
                                {
                                    element: "#" + scope
                                        ._operators["FilterReduce"]
                                        ._target,
                                    intro: "The 'Parameter Space' panel explores the effect of different hyperparameters " +
                                        "on the faithfulness of embeddings measured by various objectives. Specifically," +
                                        " it shows: " +
                                        "<ul>" +
                                            "<li>The distributions of hyperparameters and objectives in the each column's top" +
                                            " chart,</li>" +
                                            "<li>the correlation of each hyperparameter with each objective in the left " +
                                            "(square) part of the panel, </li>" +
                                            "<li>the correlation between objectives in the right (triangular) part of the panel</li>" +
                                            "<li>and the ratings assigned by you in the 'User ratings' box to the right.</li>" +
                                        "</ul> "
                                },
                                {
                                    element: "#" + scope
                                        ._operators["FilterReduce"]
                                        ._panels["Parameter Space"]
                                        ._histogramDivIDs["n_components"],
                                    intro: "Charts in the top row show the distribution of a hyperparameter or objective " +
                                        "(here: number of dimensions in the low-dimensional space)."
                                },
                                {
                                    element: "#" + scope
                                        ._operators["FilterReduce"]
                                        ._panels["Parameter Space"]
                                        ._charts["n_components:runtime"]
                                        ._target,
                                    intro: "This is a 'Scattered Scree Plot' (SSP) visualizing the relationship between a " +
                                        "hyperparameter and an objective. The underlying idea here is to show how an " +
                                        "embedding changes w.r.t. one objective when only one hyperparameter (HP) is " +
                                        "manipulated. This is achieved by: " +
                                        "<ol>" +
                                            "<li> Define values to be sampled for each HP. Generate all resulting HP configurations.</li>" +
                                            "<li> Compute the low-dimensional embeddings for these HP configurations.</li>" +
                                            "<li> When showing hyperparameter <i>H</i> and objective <i>O</i>: Group " +
                                            "together those configurations where all HPs are equal except for <i>H</i>.</li>" +
                                            "<li> Plot the values for <i>O</i> for each group as a line. Each line represents " +
                                            "the behaviour of one HP configuration with changing values for  <i>H</i>.</li>" +
                                        "</ol>" +
                                        "Additionally, the bar on the right shows the correlation between <i>H</i> and" +
                                        "<i>O</i> in percent."
                                },
                                {
                                    element: "#" + scope
                                        ._operators["FilterReduce"]
                                        ._panels["Parameter Space"]
                                        ._charts["runtime:r_nx"]
                                        ._target,
                                    intro: "The relationship two objectives are shown as honeycomb plots. The color " +
                                        "saturation indicates how many HP configurations are placed in corresponding bin."
                                },
                                {
                                    element: "#embeddings-ratings-box",
                                    intro: "This box shows the ratings that you have assigned to embeddings - 5 " +
                                        "representing good, 1 bad. By default all embeddings have a rating of 0 - you can " +
                                        "see and select those by clicking 'Show unrated'."
                                },
                                {
                                    element: "#" + scope
                                        ._operators["FilterReduce"]
                                        ._panels["Model Selection"]
                                        .table
                                        ._target,
                                    intro: "This table shows all embeddings included in the selected dataset, allowing " +
                                        "filtering and sorting.<br>A double-click on a single row load detailed information " +
                                        "on this model in the rightmost panel."
                                },
                                {
                                    element: $(
                                        `#${scope
                                            ._operators["Explainer"]
                                            ._panels["Hyperparameter Influence"]
                                            ._divStructure
                                            .chartContainerID} > svg`
                                    )[0],
                                    intro: "The influence of hyperparameters on objectives in the selected subset of " +
                                        "embeddings is shown in this heatmap. Note that it is computed by comparing the " +
                                        "selected sub- to the entire set of embeddings - as long no selection has taken" +
                                        " place, no effects are visible here."
                                }
                            ],
                            showStepNumbers: false,
                            disableInteraction: true,
                            exitOnOverlayClick: false,
                            keyboardNavigation: true,
                            hideNext: true,
                            showProgress: true,
                            exitOnEsc: true
                        });
                        intro.start();
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