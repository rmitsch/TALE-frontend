import Utils from "../Utils.js";
import Dataset from "./Dataset.js";


/**
 * Class containing data and methods for one individual DR model with all relevant details, i. e. records' labels,
 * classes, coordinates etc.
 */
export default class ModelDetailDataset extends Dataset
{
    /**
     * Initializes new ModelDetailDataset.
     * @param name
     * @param modelID
     * @param modelDataJSON Array of JSON objects holding model detail data.
     * @param drMetaDataset Reference to DRMetaDataset. Used to fetch data on embedding metadata and attribute metadata.
     */
    constructor(name, modelID, modelDataJSON, drMetaDataset)
    {
        super(name, modelDataJSON);

        // Update internal state.
        this._modelID                       = modelID;
        this._drMetaDataset                 = drMetaDataset;
        this._binCount                      = drMetaDataset._binCount;
        this._low_dim_projection            = modelDataJSON.original_dataset;
        this._dataset_for_table             = JSON.parse(modelDataJSON.original_dataset_for_table);
        this._allModelMetadata              = modelDataJSON.model_metadata;
        this._explanations                  = modelDataJSON.explanations;
        this._preprocessedExplanationData   = ModelDetailDataset._preprocessExplainerData(
            this._explanations, modelDataJSON.explanation_columns
        );
        this._pairwiseDisplacementData      = modelDataJSON.pairwise_displacement_data;
        this._corankingMatrixData           = modelDataJSON.coranking_matrix_data;

        // Gather attributes available for original record.
        this._attributeDataTypes        = modelDataJSON.attribute_data_types;
        this._originalRecordAttributes  = Object.keys(modelDataJSON.original_dataset[0]).filter(
            key => isNaN(key) && key in this._attributeDataTypes
        );

        //--------------------------------------
        // Initialize crossfilter datasets.
        //--------------------------------------

        this._crossfilterData = {};
        this._initCrossfilterData();
    }

    /**
     * Initializes crossfilter-related data.
     * @private
     */
    _initCrossfilterData()
    {
        for (let cf_dataset_name of ["low_dim_projection", "explainer", "pairwiseDisplacement"]) {
            this._crossfilterData[cf_dataset_name] = {
                crossfilter: null,
                dimensions: {},
                groups: {},
                extrema: {},
                intervals: {}
            }
        }

        // Create crossfilter instance for...
        // ...low-dimensional projection (LDP).
        this._crossfilterData["low_dim_projection"].crossfilter     = crossfilter(this._low_dim_projection);
        // ...explainer heatmap.
        this._crossfilterData["explainer"].crossfilter              = crossfilter(this._preprocessedExplanationData);
        // ...pairwise displacement data.
        this._crossfilterData["pairwiseDisplacement"].crossfilter = crossfilter(this._pairwiseDisplacementData);

        // Initialize dimensions and groups for crossfilter datasets.
        this._configureCoreCrossfilter();
        this._configureExplanationsCrossfilter();
        // this._configurePairwiseDisplacementCrossfilter();
    }

    /**
     * Preprocesses SHAP data to fit data pattern expected by crossfilter.js.
     * @param explanations
     * @param explanationColumns
     * @returns {Array}
     * @private
     */
    static _preprocessExplainerData(explanations, explanationColumns)
    {
        let parsedExplainerData = [];

        for (let objective in explanations) {
            for (let i = 0; i < explanationColumns.length; i++) {
                parsedExplainerData.push({
                    "objective": objective,
                    "hyperparameter": explanationColumns[i],
                    "weight": explanations[objective][i]
                });
            }
        }

        return parsedExplainerData;
    }

    /**
     * Configures dimensions and groups for explanations crossfilter used in heatmap.
     * @private
     */
    _configureExplanationsCrossfilter()
    {
        // Keep in mind that heatmap cells/labels have to be linked to rule data, incl. comparator;
        // while heatmap only shows rule weight.
        let config = this._crossfilterData.explainer;

        // Initialize dimensions.
        config.dimensions["weight"]                     = config.crossfilter.dimension(d => +d.weight);
        config.dimensions["objective:hyperparameter"]   = config.crossfilter.dimension(
            d => [d.objective, d.hyperparameter]
        );

        // Initialize group returning rule weight.
        config.groups["objective:hyperparameter"] = config.dimensions["objective:hyperparameter"].group().reduceSum(
            d => +d.weight
        );

        // Calculate extrema.
        let extremaInfo             = this._calculateSingularExtremaByDimension(config.dimensions["weight"], "weight");
        config.extrema["weight"]    = extremaInfo.extrema;
        config.intervals["weight"]  = extremaInfo.interval;
    }

    /**
     * Initializes all crossfilter-specific data used for low-dimensional projection/coordinates
     * and attributes.
     * @private
     */
    _configureCoreCrossfilter()
    {
        // Create dimensions/groups, determine extrema.
        this._initSingularDimensionsAndGroups();
        this._initHistogramDimensionsAndGroups();
        this._initBinaryDimensionsAndGroups();
    }

    get data()
    {
        return this._data;
    }

    _initSingularDimensionsAndGroups()
    {
        let config          = this._crossfilterData.low_dim_projection;
        let cf              = config.crossfilter;

        // Create dimensions/groups for attribute data.
        for (let attribute in this._attributeDataTypes) {
            if (this._attributeDataTypes[attribute]["supertype"] !== "categorical") {
                this._cf_dimensions[attribute] = cf.dimension(d => d[attribute]);
                this._calculateSingularExtremaByAttribute(attribute);
            }
        }

        // Create dimensions/groups for projection data.
        for (let i = 0; i < Math.max(this._allModelMetadata[this._modelID].n_components, 2); i++) {
            config.dimensions[i]  = cf.dimension(d => d[i]);
            const extremaInfo     = this._calculateSingularExtremaByDimension(config.dimensions[i], i);
            config.extrema[i]     = extremaInfo.extrema;
            config.intervals[i]   = extremaInfo.interval;
        }

        // Create ID dimension.
        config.dimensions["id"] = cf.dimension(d => d.id);
        // Workaround for coordination of multiple charts w/o crossfilter instance: Use multiple ID dimensions - one per
        // chart w/o crossfilter.
        // Alternative: Central management instance (i. e. fake crossfilter) to coordinate one filter per chart.
        // Note that this could also be achieved by using the dimensions related to the chart's actual dimensions,
        // in this case HD and LD distances. This would require information on which value ranges a bin contains though,
        // so in this case it's easier to reflect the state of selection in the Shepard diagram via a duplicate ID
        // dimension.
        config.dimensions["idShepardDiagram"]   = cf.dimension(d => d.id);
        config.dimensions["idCorankingMatrix"]  = cf.dimension(d => d.id);
    }

    _initHistogramDimensionsAndGroups()
    {
        let config  = this._crossfilterData.low_dim_projection;
        let cf      = config.crossfilter;

        for (let attribute in this._attributeDataTypes) {
            if (this._attributeDataTypes[attribute]["supertype"] !== "categorical") {
                const histogramAttribute = attribute + "#histogram";

                // Create dimension and group for histogram.
                this._cf_dimensions[histogramAttribute] = cf.dimension(d => d[histogramAttribute]);
                this._cf_groups[histogramAttribute]     = this._generateGroupWithCountsWithoutExtrema(histogramAttribute);

                // Calculate extrema.
                this._calculateExtremaForAttribute(histogramAttribute, "numerical");
            }
        }
    }

    _initBinaryDimensionsAndGroups(includeGroups = true)
    {
        let config          = this._crossfilterData["low_dim_projection"];
        let cf              = config.crossfilter;
        let numDimensions   = this._allModelMetadata[this._modelID].n_components;

        // Generate groups for all combinations of dimension indices.
        for (let i = 0; i < numDimensions; i++) {
            // Consider that "fake" coordinate in 1D projections has to be part of a binary dim./group as well.
            for (let j = i + 1; j < (numDimensions > 1 ? numDimensions : 2); j++) {
                let combinedKey     = i + ":" + j;
                let transposedKey   = j + ":" + i;

                // Create combined dimension (for scatterplot).
                config.dimensions[combinedKey] = cf.dimension(
                    function(d) { return [d[i], d[j], d.id]; }
                );
                // Mirror dimension to transposed key.
                config.dimensions[transposedKey] = config.dimensions[combinedKey];

                // Create group for scatterplot.
                config.groups[combinedKey] = this._generateGroupWithCountsForDimension(
                    config.dimensions[combinedKey], [i, j]
                );
                // Mirror group to transposed key.
                config.groups[transposedKey] = config.groups[combinedKey];
            }
        }
    }

    /**
     * Creates JSON object containing data preprocessed for usage in sparkline histograms - i. e. with filled gaps and
     * color/bin label encoding.
     * Note that presentation-specific encoding should actually happen in frontend.
     * @returns {{hyperparameters: {}, objectives: {}}}
     * @private
     */
    preprocessDataForSparklines()
    {
        let drMetaDataset       = this._drMetaDataset;
        // Fetch metadata structure (i. e. attribute names and types).
        let metadataStructure   = drMetaDataset._metadata;
        let currModelID         = this._modelID;

        // Gather values for bins from DRMetaDataset instance.
        let values = { hyperparameters: {}, objectives: {} };

        for (let valueType in values) {
            for (let attribute of metadataStructure[valueType]) {
                const key           = valueType === "hyperparameters" ? attribute.name : attribute;
                const groupAll      = drMetaDataset._cf_groups[key + "#histogram"].all();
                let unprocessedBins = JSON.parse(JSON.stringify(groupAll));
                const binWidth      = drMetaDataset._cf_intervals[key] / drMetaDataset._binCount;

                // Determine whether this attribute is numerical and hence should be binned or categorical (i. e. there
                // is no need for binning).
                const isCategorical = valueType === "hyperparameters" && attribute.type === "categorical";
                const useBinning    = !isCategorical && binWidth !== 0;

                // Fill gaps with placeholder bins - we want empty bins to be respected in sparkline chart.
                // Only consider numerical values for now.
                let bins = useBinning ? [] : unprocessedBins;
                if (useBinning) {
                    for (let i = 0; i < drMetaDataset._binCount; i++) {
                        let currBinKey  = drMetaDataset._cf_extrema[key].min + binWidth * i;
                        let currBin     = unprocessedBins.filter(bin => {
                            return bin.key === currBinKey || bin.key > currBinKey && i === drMetaDataset._binCount - 1;
                        });

                        // Current bin not available: Create fake bin to bridge gap in chart.
                        currBin = currBin.length > 0 ? currBin[0] : {
                                key: currBinKey,
                                value: {count: 0, extrema: {}}
                        };
                        currBin.nextKey = currBinKey + binWidth;

                        // Correct key for last bin.
                        if (i === drMetaDataset._binCount - 1) {
                            currBin.key     -= binWidth;
                            currBin.nextKey = drMetaDataset._cf_extrema[key].max;
                        }

                        bins.push(currBin);
                    }
                }

                // Build dict for this attribute.
                values[valueType][key]      = {data: [], extrema: drMetaDataset._cf_extrema[key], colors: null, tooltips: null};
                // Compile data list.
                values[valueType][key].data = isCategorical ? bins.map(bin => bin.value) : bins.map(bin => bin.value.count);

                // Compile color map.
                values[valueType][key].colors = bins.map(
                    bin => useBinning ?
                    // If attribute is numerical or binWidth === 0: Check if list of items in bin contains current model
                    // with this ID.
                    this._allModelMetadata[currModelID][key] >= bin.key &&
                    (
                        this._allModelMetadata[currModelID][key] < bin.nextKey ||
                        (
                            this._allModelMetadata[currModelID][key] === bin.nextKey &&
                            bin.nextKey === values[valueType][key].extrema.max
                        )
                    ) ? "red" : "#1f77b4" :
                    // If attribute is categorical: Check if bin key/title is equal to current model's attribute value.
                    (bin.key === this._allModelMetadata[currModelID][key] ? "red" : "#1f77b4")
                );

                // Compile tooltip map.
                values[valueType][key].tooltips = {};
                for (let i = 0; i < bins.length; i++) {
                    values[valueType][key].tooltips[i] = useBinning ?
                        bins[i].key.toFixed(4) + " - " + (bins[i].key + binWidth).toFixed(4) : bins[i].key;
                }
            }
        }

        return values;
    }

    get crossfilterData()
    {
        return this._crossfilterData;
    }

    get cf_dimensions()
    {
        return this._cf_dimensions;
    }

    get cf_extrema()
    {
        return this._cf_extrema;
    }

    get cf_groups()
    {
        return this._cf_groups;
    }

    /**
     * Returns currently filtered record IDs as set.
     * @returns {Set<any>}
     */
    get currentlyFilteredIDs()
    {
        return new Set(this._crossfilterData.low_dim_projection.dimensions.id.top(Infinity).map(record => record.id));
    }

    /**
     * Returns IDs of currently filtered records as set.
     * @param distanceMetric
     * @param filteredIDs
     * @returns {*} List of currently filtered pairwise displacement records.
     */
    getCurrentlyFilteredPairwiseDisplacmentRecordIDs(distanceMetric, filteredIDs)
    {
        if (filteredIDs === null)
            filteredIDs = this.currentlyFilteredIDs;

        return new Set(
            this._pairwiseDisplacementData
                .filter(
                    record =>
                        // Make sure that dataset to be drawn includes only...
                        // ...filtered IDs.
                        filteredIDs.has(record.source) &&
                        filteredIDs.has(record.neighbour) &&
                        // ...pairings with the chosen distance metric.
                        record.metric === distanceMetric
                )
                .flatMap(record => [record.source, record.neighbour])
        );
    }

    /**
     * Fetches numerical attributes.
     * @returns {string[]}
     */
    get numericalAttributes()
    {
        return Object.keys(this._attributeDataTypes).filter(
            attr => this._attributeDataTypes[attr]["supertype"] !== "categorical"
        );
    }

    /**
     * Fetches dataset prepared for detail panel table.
     * @returns {any}
     */
    get dataset_for_table()
    {
        return this._dataset_for_table;
    }
}