// ユーティリティ関数

// 衝突判定
export function checkCollision(
    x1: number, y1: number, width1: number, height1: number,
    x2: number, y2: number, width2: number, height2: number
): boolean {
    return (
        x1 < x2 + width2 &&
        x1 + width1 > x2 &&
        y1 < y2 + height2 &&
        y1 + height1 > y2
    );
}

// 距離計算
export function distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// ランダムな色を生成する関数
export function getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
} 