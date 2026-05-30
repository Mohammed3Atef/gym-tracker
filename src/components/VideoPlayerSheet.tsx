import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoAsset } from '@/types';
import { Sheet } from './Sheet';
import { useVideos } from '@/stores/videoStore';
import { youtubeEmbed } from '@/services/video/VideoStore';

interface VideoPlayerSheetProps {
  asset: VideoAsset | null;
  title: string;
  onClose: () => void;
}

/** Plays a video offline when downloaded, embeds YouTube online, else shows fallback. */
export function VideoPlayerSheet({ asset, title, onClose }: VideoPlayerSheetProps) {
  const { t } = useTranslation();
  const playableUrl = useVideos((s) => s.playableUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    setFailed(false);
    if (asset) {
      void playableUrl(asset).then((u) => {
        setUrl(u);
        if (u && u.startsWith('blob:')) revoked = u;
      });
    } else {
      setUrl(null);
    }
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [asset, playableUrl]);

  if (!asset) return null;

  const embed = asset.sourceUrl ? youtubeEmbed(asset.sourceUrl) : null;
  const isFilePlayable = asset.status === 'downloaded' || asset.kind === 'file';

  return (
    <Sheet open={!!asset} onClose={onClose} title={title}>
      {asset.status === 'link-pending' || !asset.sourceUrl ? (
        <p className="rounded-xl bg-surface-raised/60 p-3 text-sm text-slate-300">{t('video.fallback')}</p>
      ) : embed && asset.status !== 'downloaded' ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl">
          <iframe
            className="h-full w-full"
            src={embed}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : isFilePlayable && url && !failed ? (
        <video
          src={url}
          controls
          playsInline
          autoPlay
          className="w-full rounded-xl"
          onError={() => setFailed(true)}
        />
      ) : failed ? (
        <p className="rounded-xl bg-surface-raised/60 p-3 text-sm text-slate-300">
          {t('video.missingFile')}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="rounded-xl bg-surface-raised/60 p-3 text-sm text-slate-300">{t('video.fallback')}</p>
          {asset.sourceUrl && (
            <a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="btn-primary w-full">
              {t('video.openOnline')}
            </a>
          )}
        </div>
      )}
    </Sheet>
  );
}
