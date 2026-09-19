import React, { useEffect, useRef, useState } from 'react';

// Measures an element's width so SVG text stays at real pixel size.
const useWidth = <T extends HTMLElement>(): [React.RefObject<T | null>, number] => {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(640);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => setWidth(el.clientWidth);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width];
};

// Round, human-friendly axis ticks from 0 to just above `max`.
const niceTicks = (max: number, count = 4): number[] => {
    if (max <= 0) return [0];
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
    const ticks: number[] = [];
    for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(v);
    return ticks;
};

export interface LineSeries {
    name: string;
    color: string;
    values: number[];
}

interface LineChartProps {
    series: LineSeries[];
    xLabel: (i: number) => string;
    xTicks: number[];
    format: (v: number) => string;
    formatAxis: (v: number) => string;
    ariaLabel: string;
}

export const LineChart: React.FC<LineChartProps> = ({ series, xLabel, xTicks, format, formatAxis, ariaLabel }) => {
    const [ref, width] = useWidth<HTMLDivElement>();
    const [hover, setHover] = useState<number | null>(null);
    const height = 280;
    const m = { top: 16, right: 16, bottom: 32, left: 64 };
    const w = Math.max(width - m.left - m.right, 50);
    const h = height - m.top - m.bottom;
    const n = series[0]?.values.length ?? 0;
    const maxY = Math.max(...series.flatMap(s => s.values), 1);
    const ticks = niceTicks(maxY);
    const top = ticks[ticks.length - 1];
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * w);
    const y = (v: number) => h - (v / top) * h;

    const path = (values: number[]) =>
        values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

    const indexAt = (clientX: number, rect: DOMRect) => {
        const px = clientX - rect.left - m.left;
        return Math.min(n - 1, Math.max(0, Math.round((px / w) * (n - 1))));
    };

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const step = Math.max(1, Math.round(n / 20));
        const cur = hover ?? n - 1;
        setHover(Math.min(n - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? step : -step))));
    };

    const tipLeft = hover !== null ? m.left + x(hover) : 0;
    const tipOnLeft = hover !== null && x(hover) > w * 0.6;

    return (
        <div className="chart" ref={ref}>
            <svg
                width={width}
                height={height}
                role="img"
                aria-label={ariaLabel}
                tabIndex={0}
                onKeyDown={onKey}
                onBlur={() => setHover(null)}
                onPointerMove={(e) => setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
                onPointerLeave={() => setHover(null)}
            >
                <g transform={`translate(${m.left},${m.top})`}>
                    {ticks.map(t => (
                        <g key={t}>
                            <line className="grid" x1={0} x2={w} y1={y(t)} y2={y(t)} />
                            <text className="axis" x={-10} y={y(t)} dy="0.32em" textAnchor="end">{formatAxis(t)}</text>
                        </g>
                    ))}
                    <line className="baseline" x1={0} x2={w} y1={h} y2={h} />
                    {xTicks.map(i => (
                        <text key={i} className="axis" x={x(i)} y={h + 22} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                            {xLabel(i)}
                        </text>
                    ))}
                    {series.map(s => (
                        <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    ))}
                    {hover === null && series.map(s => (
                        <circle key={s.name} cx={x(n - 1)} cy={y(s.values[n - 1])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                    ))}
                    {hover !== null && (
                        <>
                            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={0} y2={h} />
                            {series.map(s => (
                                <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                            ))}
                        </>
                    )}
                </g>
            </svg>
            {hover !== null && (
                <div
                    className="tooltip"
                    style={{ left: tipLeft, top: m.top, transform: tipOnLeft ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
                >
                    <div className="tooltip-title">{xLabel(hover)}</div>
                    {series.map(s => (
                        <div className="tooltip-row" key={s.name}>
                            <span className="key-line" style={{ background: s.color }} />
                            <strong>{format(s.values[hover])}</strong>
                            <span>{s.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export interface StackSegment {
    name: string;
    color: string;
}

interface StackedBarsProps {
    segments: StackSegment[];
    rows: { label: string; values: number[] }[];
    format: (v: number) => string;
    ariaLabel: string;
}

// Horizontal stacked bars, one row per plan.
export const StackedBars: React.FC<StackedBarsProps> = ({ segments, rows, format, ariaLabel }) => {
    const [ref, width] = useWidth<HTMLDivElement>();
    const [hover, setHover] = useState<{ row: number; seg: number; x: number; y: number } | null>(null);
    const labelW = Math.min(110, width * 0.28);
    const valueW = 86;
    const barH = 24;
    const rowH = 56;
    const trackW = Math.max(width - labelW - valueW, 50);
    const max = Math.max(...rows.map(r => r.values.reduce((a, b) => a + b, 0)), 1);
    const height = rows.length * rowH;

    return (
        <div className="chart" ref={ref}>
            <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
                {rows.map((r, ri) => {
                    const total = r.values.reduce((a, b) => a + b, 0);
                    const yMid = ri * rowH + rowH / 2;
                    let acc = 0;
                    return (
                        <g key={r.label}>
                            <text className="bar-row-label" x={0} y={yMid} dy="0.32em">{r.label}</text>
                            {r.values.map((v, si) => {
                                const x0 = labelW + (acc / max) * trackW;
                                const segW = (v / max) * trackW;
                                acc += v;
                                const isLast = si === r.values.length - 1;
                                const gap = isLast ? 0 : 2;
                                const wDraw = Math.max(segW - gap, 0);
                                const radius = isLast ? Math.min(4, wDraw / 2) : 0;
                                const isHover = hover?.row === ri && hover?.seg === si;
                                return (
                                    <path
                                        key={si}
                                        d={roundedRightRect(x0, yMid - barH / 2, wDraw, barH, radius)}
                                        fill={segments[si].color}
                                        opacity={hover && !isHover ? 0.55 : 1}
                                        tabIndex={0}
                                        aria-label={`${r.label}, ${segments[si].name}: ${format(v)}`}
                                        onPointerMove={(e) => {
                                            const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                                            setHover({ row: ri, seg: si, x: e.clientX - rect.left, y: e.clientY - rect.top });
                                        }}
                                        onFocus={() => setHover({ row: ri, seg: si, x: x0 + wDraw / 2, y: yMid - barH / 2 })}
                                        onBlur={() => setHover(null)}
                                    />
                                );
                            })}
                            <text className="bar-row-value" x={labelW + (total / max) * trackW + 8} y={yMid} dy="0.32em">{format(total)}</text>
                        </g>
                    );
                })}
            </svg>
            {hover && (
                <div
                    className="tooltip"
                    style={{ left: hover.x, top: hover.y, transform: 'translate(-50%, calc(-100% - 12px))' }}
                >
                    <div className="tooltip-title">{rows[hover.row].label}</div>
                    <div className="tooltip-row">
                        <span className="key-line" style={{ background: segments[hover.seg].color }} />
                        <strong>{format(rows[hover.row].values[hover.seg])}</strong>
                        <span>{segments[hover.seg].name}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// Rect with square left end (the baseline) and rounded right end (the data end).
const roundedRightRect = (x: number, y: number, w: number, h: number, r: number): string =>
    `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;

export const Legend: React.FC<{ items: { name: string; color: string; shape: 'line' | 'rect' }[] }> = ({ items }) => (
    <ul className="legend">
        {items.map(i => (
            <li key={i.name}>
                <span className={i.shape === 'line' ? 'key-line' : 'key-rect'} style={{ background: i.color }} />
                {i.name}
            </li>
        ))}
    </ul>
);
