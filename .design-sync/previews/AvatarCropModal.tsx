import { AvatarCropModal } from 'job_pilot';

export function Default() {
  return (
    <div style={{ position: 'relative', minHeight: '520px' }}>
      <AvatarCropModal
        imageSrc="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=800&fit=crop&auto=format"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </div>
  );
}
