import Slider, { SliderProps } from "./Slider";

export type SliderFieldProps = SliderProps & {
    label: string;
    error?: string;
};

const SliderField = ({ label, error, ...rest }: SliderFieldProps): JSX.Element => {
    return (
        <div className="flex flex-col">
            <div className="flex justify-between">
                <label className="text-white text-opacity-50 text-xs">{label || " "}</label>
                <span>{rest.value}</span>
            </div>
            <Slider {...rest} />
            {error ? <p className="text-red-400 text-xs">{error}</p> : <div className="h-4" />}
        </div>
    );
};

export default SliderField;
