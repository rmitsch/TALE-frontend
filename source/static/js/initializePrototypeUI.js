import ExplorationStage from './stages/ExplorationStage.js';
import Utils from './Utils.js'
import DRMetaDataset from "./data/DRMetaDataset.js";
import MentalModelStage from "./stages/MentalModelStage.js";

// IDs of menu buttons.
let menuIDs = ["menu_prototype", "menu_about"];

// Initialize setup UI.
$(document).ready(function() {
    // From https://codepen.io/aaroniker/pen/MzoXaZ.
    // Because only Chrome supports offset-path, feGaussianBlur for now
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    if(!isChrome) {
        document.getElementsByClassName('infinityChrome')[0].style.display = "none";
        document.getElementsByClassName('infinity')[0].style.display = "block";
    }

    let now = new Date();
    console.log("*** DROP *** Starting construction at " + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds() + ".");
    $("#logField").text("Starting construction at " + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds() + ".");

    // -----------------------------------------------------
    // 1. Process GET parameters.
    // -----------------------------------------------------

    let metadataGETParameters = processGETParameters();

    // -----------------------------------------------------
    // 2. Initialize dataset loading button.
    // -----------------------------------------------------

    $("#load-dataset-link").click(function() {
        let baseURL = location.protocol + '//' + location.hostname + (location.port ? ':'+location.port: '');
        // Get content of dropdowns, preprocess for backend.
        let datasetNameTranslation = {
            Wine: "wine",
            MNIST: "mnist",
            "Swiss Roll": "swiss_roll",
            "VIS Papers": "vis",
            Happiness: "happiness"
        };
        let drkTranslation = {"t-SNE": "tsne", UMAP: "umap", SVD: "svd"};
        // Load new page.
        window.location.href =
            baseURL + "?dataset=" +
            datasetNameTranslation[$("#datasetLink").html()] + "&drk=" +
            drkTranslation[$("#drkernelLink").html()];
    });

    // -----------------------------------------------------
    // 3. Initialize stage handling.
    // -----------------------------------------------------

    const explorationStage          = $("#exploration-stage");
    const mentalModelStage          = $("#mental-model-stage");
    const explorationStageButton    = $("#stage-exploration-link");
    const mentalModelStageButton    = $("#stage-mental-model-link");
    let currentStage                = "exploration";

    explorationStageButton.click(() => {
        if (currentStage === "exploration")
            return;

        explorationStageButton.parent().addClass("pure-menu-selected");
        mentalModelStageButton.parent().removeClass("pure-menu-selected");
        currentStage = "exploration";

        mentalModelStage.fadeTo(1000, 0, () => {
            mentalModelStage.css("display", "none");
            explorationStage.fadeTo(1500, 1.0);
        });
    });

    mentalModelStageButton.click(() => {
        if (currentStage === "mental-model")
            return;

        mentalModelStageButton.parent().addClass("pure-menu-selected");
        explorationStageButton.parent().removeClass("pure-menu-selected");
        currentStage = "mental-model";

        explorationStage.fadeTo(1000, 0, () => {
            explorationStage.css("display", "none");
            mentalModelStage.fadeTo(1500, 1.0);
        });
    });

    // -----------------------------------------------------
    // 4. Fetch model metadata - both structure and content.
    // -----------------------------------------------------

    $("#logField").text("Fetching metadata.");
    console.log("Fetching metadata.");
    $.ajax({
        url: '/get_metadata',
        data: metadataGETParameters,
        type: 'GET',
        success: function(model_data) {
            // Parse delivered JSON with metadata for all models.
            model_data = JSON.parse(model_data);

            // Cast Object to array.
            let model_data_list = [];
            for (let key in model_data) {
                if (model_data.hasOwnProperty(key)) {
                    // Add ID to entry, then add to list.
                    let currParametrization = model_data[key];
                    currParametrization["id"] = parseInt(key);
                    model_data_list.push(currParametrization);
                }
            }

            // Get information on which hyperparameters and objectives are available.
            // Note: Sequence of calls is important, since /get_metadata_template uses information
            // made available by /get_metadata.
            $("#logField").text("Compiling and storing DRMetaDataset.");
            console.log("Compiling and storing DRMetaDataset.");
            $.ajax({
                url: '/get_metadata_template',
                type: 'GET',
                // Compile or load DRMetadatset.
                success: function (model_metadata) {
                    let dataset = new DRMetaDataset(
                        "PrototypeDataset",
                        model_data_list,
                        model_metadata,
                        10
                    );

                    // All components inside a panel are automatically linked with dc.js. Panels have to be
                    // linked with each other explicitly, if so desired (since used datasets may differ).
                    $("#logField").text("Constructing exploration stage.");
                    console.log("Constructing exploration stage.");
                    let prototypeStage = new ExplorationStage(
                        "ExplorationStage",
                        "exploration-stage",
                        {
                            modelMetadata: dataset,
                            surrogateModel: null,
                            dissonance: null
                        }
                    );
                    let mentalModelStage = new MentalModelStage(
                        "MentalModelStage",
                        "mental-model-stage",
                        {
                            modelMetadata: dataset
                        }
                    );
                }
            });
        }
     });
});

/**
 * Reads GET parameters defining which dataset and kernel to use.
 * Defaults to wine dataset + t-SNE, if none specified.
 * @returns {{datasetName: *, drKernelName: *}}
 */
function processGETParameters()
{
    // Read GET parameters.
    const datasetName   = Utils.findGETParameter("dataset") === null ? "happiness" : Utils.findGETParameter("dataset");
    const drKernelName  = Utils.findGETParameter("drk") === null ? "tsne" : Utils.findGETParameter("drk");
    const forceReload   = Utils.findGETParameter("force") === null ? "false" : Utils.findGETParameter("force");

    // Update displayed value of dropdown based on current URL parameters.
    const datasetNameTranslation = {
        wine: "Wine", mnist: "MNIST", swiss_roll: "Swiss Roll", vis: "VIS Papers", happiness: "Happiness"
    };
    const drkTranslation = {tsne: "t-SNE", umap: "UMAP", svd: "SVD"};
    $("#datasetLink").html(datasetNameTranslation[datasetName]);
    $("#drkernelLink").html(drkTranslation[drKernelName]);

    return {
        datasetName: datasetName,
        drKernelName: drKernelName,
        forceReload: forceReload === "true"
    }
}