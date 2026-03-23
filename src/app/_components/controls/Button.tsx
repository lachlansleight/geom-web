import { ReactNode } from "react";

const Button = ({
    className,
    children,
    onClick,
    disabled,
}: {
    className?: string;
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}): JSX.Element => {
    return (
        <button
            disabled={disabled}
            className={`btn ${
                disabled ? "text-opacity-60 bg-neutral-600" : "text-opacity-100 bg-neutral-800"
            } ${className || ""}`}
            onClick={onClick}
        >
            {children}
        </button>
    );
};

export default Button;
