const Overlay = ({
    style,
    children,
}: {
    style: React.CSSProperties;
    children: React.ReactNode;
}): JSX.Element => {
    return (
        <div className="fixed" style={style}>
            {children}
        </div>
    );
};

export default Overlay;
