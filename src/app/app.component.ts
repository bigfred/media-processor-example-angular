import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VideoProcessor } from '@pexip/media-processor';
import { getVideoProcessor } from './video-processor';
type SelectEffectType = 'none' | 'blur' | 'overlay';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'media-processor-example';
  processedStream: MediaStream | null = null;
  effect: SelectEffectType = 'none';
  private localStream: MediaStream | null = null;
  private currentVideoProcessor: VideoProcessor | null = null;

  private closeStreams() {
    if(this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    this.currentVideoProcessor?.close();
    this.processedStream = null;
    this.localStream = null;
  }

  async handleChangeEffect(event: Event): Promise<void> {
    const value: SelectEffectType = (event.target as HTMLSelectElement).value as SelectEffectType;
    console.log('Changing effect', value);
    await this.currentVideoProcessor?.destroy();

    try {
      this.effect = value as SelectEffectType;
      this.currentVideoProcessor = await getVideoProcessor(this.effect);
      try {
        if (this.currentVideoProcessor && this.localStream) {
          this.processedStream = await this.currentVideoProcessor.process(this.localStream);
        } else {
          this.processedStream = this.localStream;
        }
      } catch (error) {
        console.error('Error processing video stream:', error);
        this.processedStream = null;
      }
    } catch (error) {
      console.error('Error getting video processor:', error);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadHandler(event: BeforeUnloadEvent) {
    if(event) {
      console.log('Unloadhandler triggered');
      this.closeStreams();
      this.effect = 'none';
      const selectEffectElement = document.getElementById('selectEffect') as HTMLSelectElement;
      selectEffectElement.value = this.effect;
    }
  }

  ngOnInit() {
    navigator.mediaDevices
      .getUserMedia({
        video: true
      })
      .then((stream) => {
        this.localStream = stream;
        this.processedStream = stream;
      })
      .catch((error) => {
        console.error('mediaDevice.getUserMedia() error:', error);
        return;
      });
  }

  ngOnDestroy() {
    this.closeStreams();
  }

}
