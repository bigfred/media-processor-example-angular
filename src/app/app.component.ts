import { Component, HostListener, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VideoProcessor } from '@pexip/media-processor';
import { getVideoProcessor } from './video-processor';
type SelectEffectType = {
    id: 0 | 1 | 2;
    name: 'none' | 'blur' | 'overlay';
};

interface Effect {
  value: string;
  viewValue: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  effects: Effect[] = [
    {value: 'none', viewValue: 'None'},
    {value: 'blur', viewValue: 'Blur background'},
    {value: 'overlay', viewValue: 'Background replacement'},
  ];

  @ViewChild('localVideoElement') localVideoElement!: ElementRef<HTMLVideoElement>;

  title = 'media-processor-example';
  effect: string = this.effects[0].value;
  selectedEffect: SelectEffectType = { name: 'none', id: 0 };
  private localStream: MediaStream | null = null;
  processedStream: MediaStream | null = null;
  private processorCache = new Map<SelectEffectType, VideoProcessor>();
  private currentVideoProcessor: VideoProcessor | null = null;
  private effectChangeTimer: number | null = null;

  @HostListener('window:beforeunload')
  @HostListener('window:unload')
  handleWindowClose() {
    this.closeAll();
  }

  private stopStream(stream: MediaStream | null): void {
    if (!stream) {
      return;
    }

    try {
      stream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {
          console.warn('Error stopping track', t);
        }
      });
    } catch {
      console.warn('Error stopping stream', stream);
    }
  }

  private closeAll(): void {
    // this.stopStream(this.processedStream);
    this.stopStream(this.localStream);
    try {
      this.currentVideoProcessor?.close();
    } catch {
      console.warn('Error closing current processor', this.currentVideoProcessor);
    }
    this.currentVideoProcessor = null;
    // Close and clear cached processors
    try {
      for (const [effect, processor] of this.processorCache.entries()) {
        try {
          console.log('Closing processor from cache with id: ', effect.id);
          processor.close?.();
        } catch {
          console.warn('Error closing processor', processor);
        }
        try {
          processor.destroy?.();
        } catch {
          console.warn('Error destroying processor', processor);
        }
      }
    } catch {
      console.warn('Error closing cached processors');
    }
    this.processorCache.clear();
    this.processedStream = this.localStream = null;
    this.effect = this.effects[0].value;
  }


  async handleChangeEffect(e: Event): Promise<void> {
    this.effect = (e.target as HTMLSelectElement).value !== this.selectedEffect.name ? (e.target as HTMLSelectElement).value : this.effects[0].value;
    this.selectedEffect = { name: this.effect as 'none' | 'blur' | 'overlay', id: this.effect === 'none' ? 0 : this.effect === 'blur' ? 1 : 2 };
    await this.currentVideoProcessor?.destroy();
    if (this.effectChangeTimer) {
      window.clearTimeout(this.effectChangeTimer);
    }
    this.applyEffect(this.selectedEffect);
  }

  private async applyEffect(effect: SelectEffectType): Promise<void> {
    this.effect = effect.name;
    this.selectedEffect = effect;
    try {
      this.currentVideoProcessor = await this.getOrCreateProcessor(effect);
      if (this.localStream && this.currentVideoProcessor) {
        try {
          this.processedStream = await this.currentVideoProcessor.process(this.localStream);
        } catch (err) {
          console.error('Error processing video stream:', err);
          this.processedStream = null;
        }
      } else {
        this.processedStream = this.localStream;
      }
    } catch (err) {
      console.error('Error applying effect:', err);
    } finally {
      if (this.effectChangeTimer) {
        window.clearTimeout(this.effectChangeTimer);
        this.effectChangeTimer = null;
      }
    }
  }

  private async getOrCreateProcessor(effect: SelectEffectType): Promise<VideoProcessor> {
    const cached = this.processorCache.get(effect);
    if(cached) {
      return cached;
    }
    const processor = await getVideoProcessor(effect.name);
    this.processorCache.set(effect, processor);
    return processor;
  }

  get playbackVideo(): HTMLVideoElement {
    return this.localVideoElement?.nativeElement!;
  }

  async initialize(): Promise<void | "loaded"> {
    this.playbackVideo.src = '';
    this.playbackVideo.controls = false;
    try {
      this.playbackVideo.load();
    } catch (err) {
      console.warn(err);
    }
    this.playbackVideo.onloadeddata = async (_event) => {
      try {
        await this.playbackVideo.play();
      } catch (err) {
        console.warn(err);
      }
    }
    return "loaded";
  }
  async callGetUserMedia(): Promise<void> {
    try {
      const srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
      if (srcObject) {
        this.localStream = this.processedStream = srcObject;
        this.playbackVideo.controls = false;
        this.playbackVideo.muted = true;
      } else {
        this.playbackVideo.srcObject = null;
        this.processedStream = null;
        this.localStream = null;
      }
      return;
    } catch (error) {
      console.error('mediaDevice.getUserMedia() error:', error);
      return;
    }
  }

  async ngAfterViewInit(): Promise<void> {
    const ready: void | "loaded" = await this.initialize();
    if (ready !== "loaded") {
      return;
    }
    console.log('Video element ready, calling this.callGetUserMedia()');
    await this.callGetUserMedia();
  }

  ngOnDestroy() {
    this.closeAll();
  }
}
