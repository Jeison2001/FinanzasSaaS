import React from 'react';
import { AlertCircle, X } from 'lucide-react';

const NotificationBanner = ({ notifications, onDismiss, t }) => {
    // Only show general notifications, exclude subscription expiry types if they still exist in DB
    const visibleNotifications = notifications?.filter(n => n.type !== 'subscription_expiry') || [];
    
    if (visibleNotifications.length === 0) return null;

    return (
        <div className="bg-amber-50 border-b border-amber-200">
            <div className="max-w-6xl mx-auto px-4 py-3 space-y-2">
                {visibleNotifications.map((notif) => (
                    <div 
                        key={notif.id} 
                        className="flex items-center justify-between gap-4 bg-white/50 p-3 rounded-xl border border-amber-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-100 p-2 rounded-lg text-amber-600 shrink-0">
                                <AlertCircle size={18} />
                            </div>
                            <p className="text-sm font-medium text-amber-900 leading-tight">
                                {t(notif.message_key)}
                            </p>
                        </div>
                        <button
                            onClick={() => onDismiss(notif.id)}
                            className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-500 transition-colors shrink-0 cursor-pointer"
                            aria-label={t('action_dismiss')}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NotificationBanner;
