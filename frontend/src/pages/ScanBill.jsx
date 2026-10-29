import { useEffect, useRef, useState } from 'react';

export default function ScanBill() {
    const [step, setStep] = useState('idle');
    const [imagePreview, setImagePreview] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [parsedData, setParsedData] = useState({ items: [], grandTotal: 0 });
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    const loadFile = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Vui lòng chọn tệp hình ảnh hợp lệ.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Ảnh hóa đơn không được vượt quá 10 MB.');
            return;
        }

        setError('');
        setImagePreview(URL.createObjectURL(file));
        setSelectedFile(file);
        setParsedData({ items: [], grandTotal: 0 });
        setStep('preview');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        loadFile(e.dataTransfer.files[0]);
    };

    const processOCR = async () => {
        if (!selectedFile) return;
        setStep('scanning');
        setError('');

        try {
            const formData = new FormData();
            formData.append('billImage', selectedFile);

            const response = await fetch('/api/scan-bill', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Không thể xử lý hóa đơn. Vui lòng thử lại.');
            }
            if (!result.data || !Array.isArray(result.data.items)) {
                throw new Error('Dữ liệu hóa đơn trả về không hợp lệ.');
            }

            setParsedData({
                items: result.data.items.map((item, index) => ({
                    ...item,
                    id: item.id ?? `${item.name}-${index}`,
                })),
                grandTotal: Number(result.data.grandTotal) || 0,
            });
            setStep('result');
        } catch (err) {
            setError(err instanceof Error
                ? err.message
                : 'Không thể kết nối máy chủ. Vui lòng thử lại.');
            setStep('preview');
        }
    };

    const reset = () => {
        setStep('idle');
        setImagePreview(null);
        setSelectedFile(null);
        setParsedData({ items: [], grandTotal: 0 });
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">

            {/* ── Page Header ── */}
            <div className="mb-8">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-4 py-1.5 text-sm font-semibold text-[var(--primary)]">
                    📄 Quét Hóa Đơn
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] md:text-4xl">
                    Scan &amp; Chia Tiền Tự Động
                </h1>
                <p className="mt-2 text-[var(--text-muted)]">
                    Chụp hoặc tải ảnh hóa đơn để tự động nhận diện sản phẩm và giá tiền.
                </p>
            </div>

            {error && (
                <div role="alert" className="mb-6 rounded-2xl border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                    {error}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

                {/* ══ LEFT: Upload / Preview / Result ══ */}
                <div className="flex flex-col gap-6">

                    {/* Drop Zone — chỉ hiện khi chưa có ảnh */}
                    {step === 'idle' && (
                        <label
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            className={`
                flex cursor-pointer flex-col items-center justify-center gap-4
                rounded-3xl border-2 border-dashed p-14 text-center transition-all
                ${dragOver
                                    ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]'
                                }
              `}
                        >
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-3xl">
                                🖼️
                            </div>
                            <div>
                                <p className="text-base font-semibold text-[var(--text)]">Kéo &amp; thả hóa đơn vào đây</p>
                                <p className="mt-1 text-sm text-[var(--text-muted)]">hoặc nhấn để chọn ảnh từ thiết bị</p>
                            </div>
                            <span className="rounded-full bg-[var(--button-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--button-primary-text)]">
                                Chọn ảnh
                            </span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    loadFile(e.target.files[0]);
                                    e.target.value = '';
                                }}
                            />
                        </label>
                    )}

                    {/* Image Preview */}
                    {(step === 'preview' || step === 'scanning' || step === 'result') && imagePreview && (
                        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
                            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                                <span className="text-sm font-semibold text-[var(--text)]">Ảnh hóa đơn</span>
                                <button
                                    onClick={reset}
                                    className="rounded-full px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                                >
                                    ✕ Đổi ảnh
                                </button>
                            </div>
                            <div className="flex items-center justify-center bg-[var(--surface-soft)] p-4">
                                <img
                                    src={imagePreview}
                                    alt="Hóa đơn"
                                    className="max-h-80 rounded-xl object-contain shadow"
                                />
                            </div>
                        </div>
                    )}

                    {/* Scan status */}
                    {step === 'scanning' && (
                        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
                            <div className="mb-3 flex items-center gap-2">
                                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
                                <span className="text-sm font-semibold text-[var(--primary)]">Đang nhận diện nội dung hóa đơn...</span>
                            </div>
                            <p className="text-sm text-[var(--text-muted)]">Quá trình có thể mất vài giây. Vui lòng không đóng trang.</p>
                        </div>
                    )}

                    {/* Result table */}
                    {step === 'result' && parsedData.items.length > 0 && (
                        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
                            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                                <div>
                                    <h2 className="text-base font-bold text-[var(--text)]">
                                        ✅ Nhận diện được {parsedData.items.length} sản phẩm
                                    </h2>
                                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Kiểm tra lại thông tin trước khi chia tiền</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--border)] bg-[var(--surface-soft)]">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sản phẩm</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">SL</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Đơn giá</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedData.items.map((item, idx) => (
                                            <tr
                                                key={item.id}
                                                className={`border-b border-[var(--border)] transition hover:bg-[var(--primary-soft)] ${idx % 2 === 0 ? '' : 'bg-[var(--surface-soft)]'}`}
                                            >
                                                <td className="px-4 py-3 font-medium text-[var(--text)]">{item.name}</td>
                                                <td className="px-4 py-3 text-center text-[var(--text-muted)]">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {item.originalPrice && (
                                                        <span className="mr-1 text-xs text-[var(--text-muted)] line-through">
                                                            {item.originalPrice.toLocaleString('vi-VN')}đ
                                                        </span>
                                                    )}
                                                    <span className="text-[var(--text)]">{item.unitPrice.toLocaleString('vi-VN')}đ</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-[var(--text)]">
                                                    {item.totalPrice.toLocaleString('vi-VN')}đ
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Grand total */}
                            <div className="flex items-center justify-between bg-[var(--primary-soft)] px-5 py-4">
                                <span className="font-semibold text-[var(--text)]">Tổng cộng</span>
                                <span className="text-xl font-bold text-[var(--primary)]">
                                    {parsedData.grandTotal.toLocaleString('vi-VN')}đ
                                </span>
                            </div>
                        </div>
                    )}

                    {/* No results */}
                    {step === 'result' && parsedData.items.length === 0 && (
                        <div className="rounded-3xl border border-orange-200 bg-orange-50 p-6 text-center">
                            <div className="mb-2 text-3xl">🔍</div>
                            <p className="font-semibold text-orange-800">Không nhận diện được sản phẩm nào</p>
                            <p className="mt-1 text-sm text-orange-600">Hãy chụp lại hóa đơn rõ nét, đủ sáng rồi thử quét lần nữa.</p>
                        </div>
                    )}

                </div>

                {/* ══ RIGHT: Instructions + Action panel ══ */}
                <div className="flex flex-col gap-4">

                    {/* Action card */}
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
                        <h3 className="mb-4 text-base font-bold text-[var(--text)]">
                            {step === 'idle' && '🚀 Bắt đầu quét'}
                            {step === 'preview' && '📸 Sẵn sàng quét'}
                            {step === 'scanning' && '⏳ Đang xử lý...'}
                            {step === 'result' && '🎉 Hoàn tất!'}
                        </h3>

                        {step === 'idle' && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full rounded-2xl bg-[var(--button-primary)] py-3 text-sm font-bold text-[var(--button-primary-text)] transition hover:opacity-90 active:scale-95"
                            >
                                📎 Chọn ảnh hóa đơn
                            </button>
                        )}

                        {step === 'preview' && (
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={processOCR}
                                    className="w-full rounded-2xl bg-[var(--button-primary)] py-3 text-sm font-bold text-[var(--button-primary-text)] transition hover:opacity-90 active:scale-95"
                                >
                                    🔍 Bắt đầu quét bill
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--button-secondary)] py-3 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
                                >
                                    🔄 Chọn ảnh khác
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        loadFile(e.target.files[0]);
                                        e.target.value = '';
                                    }}
                                />
                            </div>
                        )}

                        {step === 'scanning' && (
                            <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary-soft)] border-t-[var(--primary)]" />
                                <p className="text-sm text-[var(--text-muted)]">AI đang đọc thông tin trên hóa đơn...</p>
                            </div>
                        )}

                        {step === 'result' && (
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={reset}
                                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--button-secondary)] py-3 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
                                >
                                    🔄 Quét hóa đơn mới
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tips card */}
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                        <h4 className="mb-3 text-sm font-bold text-[var(--text)]">💡 Mẹo chụp tốt hơn</h4>
                        <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                            {[
                                'Đặt bill trên nền phẳng, màu tương phản',
                                'Đủ ánh sáng, không có bóng đổ',
                                'Chụp thẳng góc, không nghiêng',
                                'Chữ phải rõ nét, không bị nhòe',
                                'Ảnh chứa toàn bộ hóa đơn',
                            ].map((tip, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="mt-0.5 text-[var(--primary)]">✓</span>
                                    <span>{tip}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* How it works */}
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                        <h4 className="mb-3 text-sm font-bold text-[var(--text)]">⚙️ Hoạt động thế nào?</h4>
                        <div className="space-y-3">
                            {[
                                ['1', 'Tải ảnh hóa đơn lên'],
                                ['2', 'AI nhận diện tên sản phẩm và giá'],
                                ['3', 'Kiểm tra lại số lượng, đơn giá'],
                                ['4', 'Hiển thị bảng chia tiền'],
                            ].map(([num, text]) => (
                                <div key={num} className="flex items-center gap-3">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
                                        {num}
                                    </div>
                                    <span className="text-sm text-[var(--text-muted)]">{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
