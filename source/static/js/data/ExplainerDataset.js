import Dataset from "./Dataset.js";


export default class ExplainerDataset extends Dataset {
    /**
     *
     * @param name
     * @param data Array of of explanations as objects: {id, hyperparameter, objective, value}.
     */
    constructor(name, data) {
        super(name, data);

        this._crossfilter       = crossfilter(this._data.data);
        this._max_abs_contribution = this._data.max_abs_contribution;

        // Initialize crossfilter data.
        this._initBinaryDimensionsAndGroups();
    }

    _initBinaryDimensionsAndGroups()
    {
        this._cf_dimensions["embeddingID"]              = this._crossfilter.dimension(d => d.id);
        this._cf_dimensions["objective:hyperparameter"] = this._crossfilter.dimension(
            d => [d.objective, d.hyperparameter]
        );
        const dim = this._cf_dimensions["objective:hyperparameter"];

        // Initialize group returning rule weight.
        this._cf_groups["objective:hyperparameter"] = dim.group().reduce(
            (data, item) => {
                data.sum    += item.value;
                data.abssum += Math.abs(item.value);
                data.n      += 1;
                data.avg    = data.sum / data.n;
                data.absavg = data.abssum / data.n;
                return data;
            },
            (data, item) => {
                data.sum    -= item.value;
                data.abssum -= Math.abs(item.value);
                data.n      -= 1;
                data.avg    = data.sum / data.n;
                data.absavg = data.abssum / data.n;
                return data;
            },
            (data, item) => {
                return { n: 0, avg: 0, sum: 0, abssum: 0, absavg: 0 };
            }
        );

        // Calculate extrema.
        let extremaInfo             = this._calculateSingularExtremaByDimension(dim, "value");
        this._cf_extrema["value"]   = extremaInfo.extrema;
        this._cf_intervals["value"] = extremaInfo.interval;
    }

    get max_abs_contribution()
    {
        return this._max_abs_contribution;
    }

    get crossfilter()
    {
        return this._crossfilter;
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
}