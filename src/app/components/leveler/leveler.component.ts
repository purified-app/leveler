import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-leveler',
  template: `
    <button (click)="calibrate()">Calibrate</button>
    <canvas #levelCanvas style="aspect-ratio:1; width: 100%;"></canvas>
    <div class="leveler-info">
      <h3>γ (X-axis): {{ gamma.toFixed(1) }}°</h3>
      <h3>β (Y-axis): {{ beta.toFixed(1) }}°</h3>
    </div>
  `,
  styleUrl: './leveler.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelerComponent implements AfterViewInit {
  readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('levelCanvas');
  private ctx!: CanvasRenderingContext2D;
  beta = 0;
  gamma = 0;

  private betaOffset = 0;
  private gammaOffset = 0;

  private readonly levelToleranceDegrees = 1.5;
  private readonly referenceCanvasSize = 300;

  private readonly MAX_TILT_ANGLE_DEGREES = 90;
  private readonly CIRCLE_BORDER_PADDING = 10;
  private readonly CENTER_LINE_THICKNESS_FACTOR = 0.5;

  private readonly levelerConfigs = [
    {
      type: 'circle',
      refX: 10,
      refY: 10,
      refSize: 220,
      refBubbleRadius: 12,
      refZeroCirclePadding: 3,
      refBullseyeRadius: 2,
      associatedAxis: 'both',
      lineColor: 'lightgrey',
      bubbleColorLevel: 'green',
      bubbleColorNotLevel: 'red',
      lineThickness: 1.5,
    },
    {
      type: 'verticalBar',
      refX: 250,
      refY: 10,
      refWidth: 30,
      refHeight: 220,
      refBubbleRadius: 12,
      refZeroLinePadding: 3,
      refLineShorten: 8,
      associatedAxis: 'beta',
      lineColor: 'lightgrey',
      bubbleColorLevel: 'green',
      bubbleColorNotLevel: 'red',
      lineThickness: 1.5,
    },
    {
      type: 'horizontalBar',
      refX: 10,
      refY: 250,
      refWidth: 220,
      refHeight: 30,
      refBubbleRadius: 12,
      refZeroLinePadding: 3,
      refLineShorten: 8,
      associatedAxis: 'gamma',
      lineColor: 'lightgrey',
      bubbleColorLevel: 'green',
      bubbleColorNotLevel: 'red',
      lineThickness: 1.5,
    },
  ];

  async ngAfterViewInit() {
    await this.grantAccess();
    this.ctx = this.canvasRef().nativeElement.getContext('2d')!;
    this.setCanvasDimensions();

    this.drawLeveler(0, 0);
  }

  @HostListener('window:resize')
  onResize() {
    this.setCanvasDimensions();
    this.drawLeveler(this.gamma, this.beta);
  }

  private setCanvasDimensions() {
    const canvas = this.canvasRef().nativeElement;
    const displayWidth = canvas.offsetWidth;
    canvas.width = displayWidth;
    canvas.height = displayWidth;
  }

  @HostListener('window:deviceorientation', ['$event'])
  onDeviceOrientation(event: DeviceOrientationEvent) {
    if (event.beta !== null && event.gamma !== null) {
      this.beta = event.beta - this.betaOffset;
      this.gamma = event.gamma - this.gammaOffset;
      this.drawLeveler(this.gamma, this.beta);
    }
  }

  async grantAccess() {
    const { requestPermission } = DeviceOrientationEvent as any;
    if (typeof requestPermission === 'function') {
      try {
        await requestPermission();
      } catch (error: any) {}
    }
  }

  calibrate() {
    this.grantAccess();
    this.betaOffset = this.beta;
    this.gammaOffset = this.gamma;
    this.drawLeveler(0, 0);
  }

  private drawLeveler(gamma: number, beta: number) {
    const canvas = this.canvasRef().nativeElement;
    const ctx = this.ctx;
    const currentWidth = canvas.width;

    const scaleFactor = currentWidth / this.referenceCanvasSize;

    ctx.clearRect(0, 0, currentWidth, currentWidth);
    ctx.fillStyle = '#212121';
    ctx.fillRect(0, 0, currentWidth, currentWidth);

    ctx.save();
    ctx.scale(scaleFactor, scaleFactor);

    for (const config of this.levelerConfigs) {
      let isLevelForThisLeveler = false;
      if (config.associatedAxis === 'both') {
        isLevelForThisLeveler =
          Math.abs(beta) < this.levelToleranceDegrees &&
          Math.abs(gamma) < this.levelToleranceDegrees;
      } else if (config.associatedAxis === 'beta') {
        isLevelForThisLeveler = Math.abs(beta) < this.levelToleranceDegrees;
      } else if (config.associatedAxis === 'gamma') {
        isLevelForThisLeveler = Math.abs(gamma) < this.levelToleranceDegrees;
      }

      if (config.type === 'circle') {
        this._drawCircleLeveler(
          ctx,
          config,
          gamma,
          beta,
          isLevelForThisLeveler
        );
      } else if (config.type === 'verticalBar') {
        this._drawVerticalBarLeveler(ctx, config, beta, isLevelForThisLeveler);
      } else if (config.type === 'horizontalBar') {
        this._drawHorizontalBarLeveler(
          ctx,
          config,
          gamma,
          isLevelForThisLeveler
        );
      }
    }

    ctx.restore();
  }

  private _drawCircleLeveler(
    ctx: CanvasRenderingContext2D,
    config: any,
    gamma: number,
    beta: number,
    isLevelForThisLeveler: boolean
  ) {
    const x = config.refX;
    const y = config.refY;
    const width = config.refSize;
    const height = config.refSize;
    const bubbleRadius = config.refBubbleRadius;

    const mainCenterX = x + width / 2;
    const mainCenterY = y + height / 2;
    const mainRadius = config.refSize / 2 - this.CIRCLE_BORDER_PADDING;

    ctx.beginPath();
    ctx.arc(mainCenterX, mainCenterY, config.refSize / 2, 0, 2 * Math.PI);

    const trackRadialGradient = ctx.createRadialGradient(
      mainCenterX,
      mainCenterY,
      (config.refSize / 2) * 0.1,
      mainCenterX,
      mainCenterY,
      config.refSize / 2
    );
    trackRadialGradient.addColorStop(0, 'yellow');
    trackRadialGradient.addColorStop(1, 'green');
    ctx.fillStyle = trackRadialGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(mainCenterX, mainCenterY, mainRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness * this.CENTER_LINE_THICKNESS_FACTOR;
    ctx.moveTo(mainCenterX, mainCenterY - mainRadius);
    ctx.lineTo(mainCenterX, mainCenterY + mainRadius);
    ctx.moveTo(mainCenterX - mainRadius, mainCenterY);
    ctx.lineTo(mainCenterX + mainRadius, mainCenterY);
    ctx.stroke();

    const levelTolerancePixelRadius =
      (this.levelToleranceDegrees / this.MAX_TILT_ANGLE_DEGREES) * mainRadius;
    const zeroAreaCircleRadius =
      levelTolerancePixelRadius + bubbleRadius + config.refZeroCirclePadding;
    ctx.beginPath();
    ctx.arc(mainCenterX, mainCenterY, zeroAreaCircleRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;
    ctx.stroke();

    const bullseyeRadius = config.refBullseyeRadius;
    ctx.beginPath();
    ctx.arc(mainCenterX, mainCenterY, bullseyeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = config.lineColor;
    ctx.fill();

    const bubbleMainX =
      mainCenterX - (gamma / this.MAX_TILT_ANGLE_DEGREES) * mainRadius;
    const bubbleMainY =
      mainCenterY - (beta / this.MAX_TILT_ANGLE_DEGREES) * mainRadius;

    const distFromCenter = Math.sqrt(
      (bubbleMainX - mainCenterX) ** 2 + (bubbleMainY - mainCenterY) ** 2
    );
    let finalBubbleMainX = bubbleMainX;
    let finalBubbleMainY = bubbleMainY;
    if (distFromCenter > mainRadius - bubbleRadius) {
      const angle = Math.atan2(
        bubbleMainY - mainCenterY,
        bubbleMainX - mainCenterX
      );
      finalBubbleMainX =
        mainCenterX + (mainRadius - bubbleRadius) * Math.cos(angle);
      finalBubbleMainY =
        mainCenterY + (mainRadius - bubbleRadius) * Math.sin(angle);
    }

    ctx.beginPath();
    ctx.arc(finalBubbleMainX, finalBubbleMainY, bubbleRadius, 0, 2 * Math.PI);

    const gradient = ctx.createRadialGradient(
      finalBubbleMainX - bubbleRadius * 0.3,
      finalBubbleMainY - bubbleRadius * 0.3,
      bubbleRadius * 0.1,
      finalBubbleMainX,
      finalBubbleMainY,
      bubbleRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(
      0.5,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );
    gradient.addColorStop(
      1,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;
    ctx.stroke();
  }

  private _drawVerticalBarLeveler(
    ctx: CanvasRenderingContext2D,
    config: any,
    beta: number,
    isLevelForThisLeveler: boolean
  ) {
    const x = config.refX;
    const y = config.refY;
    const width = config.refWidth;
    const height = config.refHeight;
    const bubbleRadius = config.refBubbleRadius;

    const trackLinearGradientVertical = ctx.createLinearGradient(
      x + width / 2,
      y,
      x + width / 2,
      y + height
    );
    trackLinearGradientVertical.addColorStop(0, 'green');
    trackLinearGradientVertical.addColorStop(0.5, 'yellow');
    trackLinearGradientVertical.addColorStop(1, 'green');
    ctx.fillStyle = trackLinearGradientVertical;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;
    ctx.strokeRect(x, y, width, height);

    ctx.beginPath();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness * this.CENTER_LINE_THICKNESS_FACTOR;
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(x + width / 2, y + height);
    ctx.stroke();

    const zeroLineGap = bubbleRadius + config.refZeroLinePadding;
    const lineLength = width - config.refLineShorten;
    const lineXStart = x + (width - lineLength) / 2;

    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;

    ctx.beginPath();
    ctx.moveTo(lineXStart, y + height / 2 - zeroLineGap);
    ctx.lineTo(lineXStart + lineLength, y + height / 2 - zeroLineGap);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(lineXStart, y + height / 2 + zeroLineGap);
    ctx.lineTo(lineXStart + lineLength, y + height / 2 + zeroLineGap);
    ctx.stroke();

    const bubbleVertY =
      y +
      height / 2 -
      (beta / this.MAX_TILT_ANGLE_DEGREES) * (height / 2 - bubbleRadius);
    const finalBubbleVertY = Math.min(
      Math.max(bubbleVertY, y + bubbleRadius),
      y + height - bubbleRadius
    );

    ctx.beginPath();
    ctx.arc(x + width / 2, finalBubbleVertY, bubbleRadius, 0, 2 * Math.PI);

    const gradient = ctx.createRadialGradient(
      x + width / 2 - bubbleRadius * 0.3,
      finalBubbleVertY - bubbleRadius * 0.3,
      bubbleRadius * 0.1,
      x + width / 2,
      finalBubbleVertY,
      bubbleRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(
      0.5,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );
    gradient.addColorStop(
      1,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;
    ctx.stroke();
  }

  private _drawHorizontalBarLeveler(
    ctx: CanvasRenderingContext2D,
    config: any,
    gamma: number,
    isLevelForThisLeveler: boolean
  ) {
    const x = config.refX;
    const y = config.refY;
    const width = config.refWidth;
    const height = config.refHeight;
    const bubbleRadius = config.refBubbleRadius;

    const trackLinearGradientHorizontal = ctx.createLinearGradient(
      x,
      y + height / 2,
      x + width,
      y + height / 2
    );
    trackLinearGradientHorizontal.addColorStop(0, 'green');
    trackLinearGradientHorizontal.addColorStop(0.5, 'yellow');
    trackLinearGradientHorizontal.addColorStop(1, 'green');
    ctx.fillStyle = trackLinearGradientHorizontal;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;
    ctx.strokeRect(x, y, width, height);

    ctx.beginPath();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness * this.CENTER_LINE_THICKNESS_FACTOR;
    ctx.moveTo(x, y + height / 2);
    ctx.lineTo(x + width, y + height / 2);
    ctx.stroke();

    const zeroLineGapHorz = bubbleRadius + config.refZeroLinePadding;
    const lineHeight = height - config.refLineShorten;
    const lineYStart = y + (height - lineHeight) / 2;

    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;

    ctx.beginPath();
    ctx.moveTo(x + width / 2 - zeroLineGapHorz, lineYStart);
    ctx.lineTo(x + width / 2 - zeroLineGapHorz, lineYStart + lineHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + width / 2 + zeroLineGapHorz, lineYStart);
    ctx.lineTo(x + width / 2 + zeroLineGapHorz, lineYStart + lineHeight);
    ctx.stroke();

    const bubbleHorzX =
      x +
      width / 2 -
      (gamma / this.MAX_TILT_ANGLE_DEGREES) * (width / 2 - bubbleRadius);
    const finalBubbleHorzX = Math.min(
      Math.max(bubbleHorzX, x + bubbleRadius),
      x + width - bubbleRadius
    );

    ctx.beginPath();
    ctx.arc(finalBubbleHorzX, y + height / 2, bubbleRadius, 0, 2 * Math.PI);

    const gradient = ctx.createRadialGradient(
      finalBubbleHorzX - bubbleRadius * 0.3,
      y + height / 2 - bubbleRadius * 0.3,
      bubbleRadius * 0.1,
      finalBubbleHorzX,
      y + height / 2,
      bubbleRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(
      0.5,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );
    gradient.addColorStop(
      1,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineThickness;
    ctx.stroke();
  }
}
