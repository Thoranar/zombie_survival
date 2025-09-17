/**
 * Responsibility: Engine-agnostic rendering + input surface for the game.
 * Publishes: none
 * Subscribes: none
 * Config: colors/palette may be added later; milestone 0 uses simple defaults.
 * Notes: A thin adapter makes the core loop independent of rendering engine.
 */
export interface IEngineAdapter {
  init(_container: HTMLElement): void;
  drawGrid(_tileSize: number): void;
  drawPlayer(_x: number, _y: number, _radius: number): void;
  drawResourceNode(x: number, y: number, radius: number, color: string, capacityPct: number): void;
  drawTintOverlay(color: string, alpha: number): void;
  setCameraCenter(x: number, y: number): void;
  setWorldSize(widthPx: number, heightPx: number): void;
  screenToWorld(sx: number, sy: number): { x: number; y: number };
  setZoom(scale: number): void;
  drawVerticalProgress(
    x: number,
    y: number,
    width: number,
    height: number,
    progress01: number,
    aboveCenterPx?: number
  ): void;
  getViewportWorldAABB(): { x: number; y: number; width: number; height: number };
  drawStorageCrate(x: number, y: number, sizePx: number): void;
  drawAABB(x: number, y: number, halfW: number, halfH: number, color: string): void;
  drawCircleOutline(x: number, y: number, radius: number, color: string): void;
  drawWall(x: number, y: number, sizePx: number, type: 'Wall' | 'Door', selected: boolean, open: boolean): void;
  drawTextWorld(x: number, y: number, text: string, color: string): void;
  drawFilledCircle(x: number, y: number, radius: number, color: string): void;
  drawVector(x: number, y: number, vx: number, vy: number, color: string): void;
  clear(): void;
  destroy(): void;
}

/**
 * Minimal Canvas2D adapter to satisfy Milestone 0 without external deps.
 * This can be swapped for Pixi/Phaser later without changing GameApp.
 */
export class Canvas2DEngine implements IEngineAdapter {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private camX = 0;
  private camY = 0;
  private worldW = 0;
  private worldH = 0;
  private scale = 1;

  public init(container: HTMLElement): void {
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.resizeToContainer(container);
    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas2D not supported');
    this.ctx = ctx;
    // react to window resizes
    window.addEventListener('resize', this.onResize);
  }

  public drawGrid(tileSize: number): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.strokeStyle = '#2c2f33';
    this.ctx.lineWidth = 1;

    const halfW = width / 2;
    const halfH = height / 2;
    // Compute world-space viewport bounds
    const viewLeft = this.camX - halfW / this.scale;
    const viewTop = this.camY - halfH / this.scale;
    const viewRight = this.camX + halfW / this.scale;
    const viewBottom = this.camY + halfH / this.scale;

    // Find first grid lines at or before the top-left corner in world space
    const firstX = Math.floor(viewLeft / tileSize) * tileSize;
    const firstY = Math.floor(viewTop / tileSize) * tileSize;

    for (let gx = firstX; gx <= viewRight; gx += tileSize) {
      const sx = (gx - this.camX) * this.scale + halfW + 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(sx, 0);
      this.ctx.lineTo(sx, height);
      this.ctx.stroke();
    }
    for (let gy = firstY; gy <= viewBottom; gy += tileSize) {
      const sy = (gy - this.camY) * this.scale + halfH + 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, sy);
      this.ctx.lineTo(width, sy);
      this.ctx.stroke();
    }
  }

  public drawPlayer(x: number, y: number, radius: number): void {
    this.ctx.fillStyle = '#4caf50';
    this.ctx.beginPath();
    const screen = this.worldToScreen(x, y);
    this.ctx.arc(screen.x, screen.y, radius * this.scale, 0, Math.PI * 2);
    this.ctx.fill();
  }

  public drawResourceNode(x: number, y: number, radius: number, color: string, capacityPct: number): void {
    const s = this.worldToScreen(x, y);
    // node body
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    const rr = radius * this.scale;
    this.ctx.arc(s.x, s.y, rr, 0, Math.PI * 2);
    this.ctx.fill();
    // capacity bar
    const barW = rr * 2;
    const barH = 6;
    const left = s.x - rr;
    const top = s.y - rr - 10;
    this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.ctx.fillRect(left, top, barW, barH);
    this.ctx.fillStyle = '#4caf50';
    this.ctx.fillRect(left, top, Math.max(0, Math.min(1, capacityPct)) * barW, barH);
  }

  public drawTintOverlay(color: string, alpha: number): void {
    if (alpha <= 0) return;
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = alpha;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  public setCameraCenter(x: number, y: number): void {
    // Clamp camera to world bounds so edges are not exposed beyond world
    const halfW = this.canvas.width / (2 * this.scale);
    const halfH = this.canvas.height / (2 * this.scale);
    const minX = halfW;
    const minY = halfH;
    const maxX = Math.max(this.worldW - halfW, halfW);
    const maxY = Math.max(this.worldH - halfH, halfH);
    this.camX = Math.min(Math.max(x, minX), maxX);
    this.camY = Math.min(Math.max(y, minY), maxY);
  }

  public setWorldSize(widthPx: number, heightPx: number): void {
    this.worldW = widthPx;
    this.worldH = heightPx;
  }

  private worldToScreen(x: number, y: number): { x: number; y: number } {
    const halfW = this.canvas.width / 2;
    const halfH = this.canvas.height / 2;
    return { x: (x - this.camX) * this.scale + halfW, y: (y - this.camY) * this.scale + halfH };
  }

  public screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const halfW = this.canvas.width / 2;
    const halfH = this.canvas.height / 2;
    return { x: (sx - halfW) / this.scale + this.camX, y: (sy - halfH) / this.scale + this.camY };
  }

  public getViewportWorldAABB(): { x: number; y: number; width: number; height: number } {
    const halfW = this.canvas.width / (2 * this.scale);
    const halfH = this.canvas.height / (2 * this.scale);
    return { x: this.camX - halfW, y: this.camY - halfH, width: halfW * 2, height: halfH * 2 };
  }

  public setZoom(scale: number): void {
    this.scale = Math.max(0.1, scale);
  }

  public drawStorageCrate(x: number, y: number, sizePx: number): void {
    const s = this.worldToScreen(x, y);
    const size = sizePx * this.scale;
    const half = size / 2;
    this.ctx.fillStyle = '#ffc107';
    this.ctx.strokeStyle = '#795548';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(s.x - half, s.y - half, size, size);
    this.ctx.strokeRect(s.x - half + 0.5, s.y - half + 0.5, size, size);
  }

  public drawAABB(x: number, y: number, halfW: number, halfH: number, color: string): void {
    const s = this.worldToScreen(x, y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(
      s.x - halfW * this.scale + 0.5,
      s.y - halfH * this.scale + 0.5,
      (halfW * 2) * this.scale,
      (halfH * 2) * this.scale
    );
  }

  public drawCircleOutline(x: number, y: number, radius: number, color: string): void {
    const s = this.worldToScreen(x, y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(s.x, s.y, radius * this.scale, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  public drawWall(x: number, y: number, sizePx: number, type: 'Wall' | 'Door', selected: boolean, open: boolean): void {
    const s = this.worldToScreen(x, y);
    const size = sizePx * this.scale;
    const half = size / 2;
    const baseFill = type === 'Door' ? '#9e6d44' : '#6d4c41';
    this.ctx.fillStyle = selected ? '#d4af37' : baseFill;
    this.ctx.strokeStyle = '#3e2723';
    this.ctx.lineWidth = 1.5;
    // Outline
    this.ctx.strokeRect(s.x - half + 0.5, s.y - half + 0.5, size, size);
    if (type === 'Door' && open) {
      // Open door: outline only
      return;
    }
    // Closed door or wall: draw inner fill to leave visible border
    const inset = Math.floor(size * 0.2);
    this.ctx.fillRect(s.x - half + inset, s.y - half + inset, size - inset * 2, size - inset * 2);
  }

  public drawTextWorld(x: number, y: number, text: string, color: string): void {
    const s = this.worldToScreen(x, y);
    this.ctx.fillStyle = color;
    this.ctx.font = '12px monospace';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, s.x, s.y);
  }

  public drawFilledCircle(x: number, y: number, radius: number, color: string): void {
    const s = this.worldToScreen(x, y);
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(s.x, s.y, radius * this.scale, 0, Math.PI * 2);
    this.ctx.fill();
  }

  public drawVector(x: number, y: number, vx: number, vy: number, color: string): void {
    const from = this.worldToScreen(x, y);
    const to = this.worldToScreen(x + vx, y + vy);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    // arrow head
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = 6;
    const hx1 = to.x - headLen * Math.cos(ang - Math.PI / 6);
    const hy1 = to.y - headLen * Math.sin(ang - Math.PI / 6);
    const hx2 = to.x - headLen * Math.cos(ang + Math.PI / 6);
    const hy2 = to.y - headLen * Math.sin(ang + Math.PI / 6);
    this.ctx.beginPath();
    this.ctx.moveTo(to.x, to.y);
    this.ctx.lineTo(hx1, hy1);
    this.ctx.moveTo(to.x, to.y);
    this.ctx.lineTo(hx2, hy2);
    this.ctx.stroke();
  }

  public drawVerticalProgress(
    x: number,
    y: number,
    width: number,
    height: number,
    progress01: number,
    aboveCenterPx: number = 12
  ): void {
    const p = Math.max(0, Math.min(1, progress01));
    const s = this.worldToScreen(x, y);
    const left = s.x - width / 2;
    const top = s.y - aboveCenterPx - height; // above target point by given offset
    // background
    this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.ctx.fillRect(left, top, width, height);
    // fill downward (remaining)
    const fillH = height * (1 - p);
    this.ctx.fillStyle = '#ffd54f';
    this.ctx.fillRect(left, top, width, fillH);
    // border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(left + 0.5, top + 0.5, width, height);
  }

  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.canvas.remove();
    // @ts-expect-error mark for GC
    this.ctx = undefined;
  }

  private onResize = (): void => {
    const parent = this.canvas.parentElement as HTMLElement | null;
    if (!parent) return;
    this.resizeToContainer(parent);
  };

  private resizeToContainer(container: HTMLElement): void {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
  }
}
