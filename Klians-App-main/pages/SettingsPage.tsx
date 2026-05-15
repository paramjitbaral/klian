import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { Theme } from '../types';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { ICONS } from '../constants';
import { useAuth } from '../hooks/useAuth';

type SettingsCategory = 'profile' | 'security' | 'appearance' | 'privacy' | 'danger';

const settingsNav: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Edit Profile', icon: ICONS.profile },
    { id: 'security', label: 'Password & Security', icon: ICONS.security },
    { id: 'appearance', label: 'Appearance', icon: ICONS.sun },
    { id: 'danger', label: 'Danger Zone', icon: ICONS.danger },
];

// Helper function to validate and convert image to base64
const validateAndConvertImage = (file: File): Promise<{ base64: string; error?: string }> => {
    return new Promise((resolve) => {
        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            resolve({ base64: '', error: 'Only PNG, JPG, and JPEG formats are allowed.' });
            return;
        }

        // Validate file size (< 2 MB - accounts for base64 encoding)
        const maxSizeMB = 2;
        if (file.size > maxSizeMB * 1024 * 1024) {
            resolve({ base64: '', error: `File size must be less than ${maxSizeMB}MB. Actual size: ${(file.size / 1024 / 1024).toFixed(2)}MB` });
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
            resolve({ base64: reader.result as string });
        };
        reader.onerror = () => {
            resolve({ base64: '', error: 'Failed to read file.' });
        };
        reader.readAsDataURL(file);
    });
};

const SettingsPanel: React.FC<{ title: string, description: string, children: React.ReactNode, footer?: React.ReactNode }> = ({ title, description, children, footer }) => (
    <div className="flex flex-col h-full max-w-5xl">
        <div className="mb-6 sm:mb-10 hidden sm:block">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h2>
            <p className="text-sm sm:text-base text-slate-500 mt-2">{description}</p>
        </div>
        <div className="flex-grow space-y-8 sm:space-y-10 pb-6 sm:pb-8">
            {children}
        </div>
        {footer && (
            <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <div className="max-w-4xl w-full mx-auto flex justify-end items-center gap-4">
                    {footer}
                </div>
            </div>
        )}
    </div>
);


export const SettingsPage: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const { user, logout, updateProfile, changePassword, requestPasswordOTP, verifyPasswordChange } = useAuth();
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile');
    const [mobileView, setMobileView] = useState<'menu' | SettingsCategory>('menu');
    const navigate = useNavigate();

    // Profile form state
    const [profileName, setProfileName] = useState(user?.name || '');
    const [profileBio, setProfileBio] = useState(user?.bio || '');
    const [profilePicturePreview, setProfilePicturePreview] = useState<string>('');
    const [coverPhotoPreview, setCoverPhotoPreview] = useState<string>('');
    const [profileLinkedin, setProfileLinkedin] = useState(user?.linkedin || '');
    const [profileGithub, setProfileGithub] = useState(user?.github || '');
    const [profilePortfolio, setProfilePortfolio] = useState(user?.portfolio || '');
    const [profilePictureError, setProfilePictureError] = useState('');
    const [coverPhotoError, setCoverPhotoError] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileSaveMessage, setProfileSaveMessage] = useState('');
    const [passwordSaveMessage, setPasswordSaveMessage] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

    // State for password fields and validation
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState({
        newPassword: '',
        confirmPassword: '',
    });

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        const errors = { newPassword: '', confirmPassword: '' };

        if (newPassword && newPassword.length < 8) {
            errors.newPassword = 'Password must be at least 8 characters long.';
        }

        if (confirmPassword && newPassword !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match.';
        }

        setPasswordErrors(errors);
    }, [newPassword, confirmPassword]);

    const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setProfilePictureError('');
        const { base64, error } = await validateAndConvertImage(file);

        if (error) {
            setProfilePictureError(error);
            setProfilePicturePreview('');
        } else {
            setProfilePicturePreview(base64);
        }
    };

    const handleCoverPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCoverPhotoError('');
        const { base64, error } = await validateAndConvertImage(file);

        if (error) {
            setCoverPhotoError(error);
            setCoverPhotoPreview('');
        } else {
            setCoverPhotoPreview(base64);
        }
    };

    const handleSaveProfile = async () => {
        if (!user) return;

        setIsSavingProfile(true);
        setProfileSaveMessage('');

        try {
            const updateData: any = {
                name: profileName,
                bio: profileBio,
                linkedin: profileLinkedin,
                github: profileGithub,
                portfolio: profilePortfolio
            };

            console.log('Sending update data:', {
                hasProfilePicture: !!profilePicturePreview,
                hasCoverPhoto: !!coverPhotoPreview,
                name: updateData.name,
                bio: updateData.bio,
                linkedin: updateData.linkedin
            });

            await updateProfile(updateData);
            setProfileSaveMessage('Profile updated successfully!');

            // Clear image previews after successful save
            setProfilePicturePreview('');
            setCoverPhotoPreview('');

            // Clear message after 3 seconds
            setTimeout(() => setProfileSaveMessage(''), 3000);
        } catch (error: any) {
            console.error('Error updating profile:', error);
            setProfileSaveMessage(error.message || 'Error updating profile');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!user || isPasswordUpdateDisabled) return;

        setIsUpdatingPassword(true);
        setPasswordSaveMessage('');

        try {
            await requestPasswordOTP(currentPassword);
            setShowOtpModal(true);
        } catch (error: any) {
            console.error('Error requesting password OTP:', error);
            setPasswordSaveMessage(error.response?.data?.message || 'Failed to send verification code.');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpValue || otpValue.length !== 6) return;

        setIsVerifyingOtp(true);
        setPasswordSaveMessage('');

        try {
            await verifyPasswordChange({
                currentPassword,
                newPassword,
                otp: otpValue
            });

            setPasswordSaveMessage('Password updated successfully!');
            setShowOtpModal(false);
            setOtpValue('');

            // Clear fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            // Clear message after 3 seconds
            setTimeout(() => setPasswordSaveMessage(''), 3000);
        } catch (error: any) {
            console.error('Error verifying OTP:', error);
            setPasswordSaveMessage(error.response?.data?.message || 'Invalid or expired code.');
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    if (!user) return null;

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/home', { replace: true });
        }
    };

    const handleMobileBackToMenu = () => setMobileView('menu');

    const isPasswordUpdateDisabled =
        !currentPassword ||
        !newPassword ||
        !confirmPassword ||
        !!passwordErrors.newPassword ||
        !!passwordErrors.confirmPassword;

    const renderContent = (category: SettingsCategory) => {
        switch (category) {
            case 'profile':
                return (
                    <SettingsPanel
                        title="Edit Profile"
                        description="Update your name, email, and other personal details."
                        footer={
                            <div className="w-full flex flex-col gap-3">
                                {profileSaveMessage && (
                                    <p className={`text-xs font-bold text-center sm:text-left ${profileSaveMessage.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                                        {profileSaveMessage}
                                    </p>
                                )}
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={isSavingProfile}
                                    className="w-full sm:w-auto sm:px-8 h-12 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20 rounded-xl"
                                >
                                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        }
                    >
                        {/* Hero Profile Header with Banner */}
                        <div className="relative mb-12">
                            {/* Top Banner */}
                            <div className="relative h-28 sm:h-36 w-full bg-slate-900 overflow-hidden sm:rounded-t-2xl">
                                {(coverPhotoPreview || user.coverPhoto) && (
                                    <img
                                        src={coverPhotoPreview || user.coverPhoto}
                                        alt=""
                                        className="w-full h-full object-cover opacity-80"
                                    />
                                )}
                                <label className="absolute top-3 right-3 bg-black/20 backdrop-blur-md text-white px-2.5 py-1.5 rounded-lg cursor-pointer text-[9px] font-bold uppercase tracking-widest hover:bg-black/40 transition-all flex items-center gap-2 z-20 border border-white/10">
                                    {React.cloneElement(ICONS.camera as React.ReactElement, { className: "h-3 w-3" })}
                                    <span>Edit Banner</span>
                                    <input type="file" accept="image/*" onChange={handleCoverPhotoChange} className="hidden" />
                                </label>
                            </div>

                            {/* Overlapping Profile Photo */}
                            <div className="flex flex-col items-center -mt-12 sm:-mt-16">
                                <div className="relative group">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-[4px] border-white dark:border-slate-900 shadow-lg overflow-hidden bg-white ring-1 ring-slate-100 dark:ring-slate-800">
                                        <img
                                            src={profilePicturePreview || user.avatar || '/default-avatar.png'}
                                            alt={user.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <label className="absolute bottom-1 right-1 bg-white dark:bg-slate-800 p-2 rounded-full shadow-md border border-slate-100 dark:border-slate-700 cursor-pointer hover:scale-110 active:scale-95 transition-all z-10 group-hover:shadow-red-500/20">
                                        {React.cloneElement(ICONS.camera as React.ReactElement, { className: "h-4 w-4 text-slate-600 dark:text-slate-400" })}
                                        <input type="file" accept="image/*" onChange={handleProfilePictureChange} className="hidden" />
                                    </label>
                                </div>
                                <div className="text-center mt-3">
                                    <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{profileName || user.name}</h1>
                                    <button 
                                        onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
                                        className="text-blue-500 text-[11px] font-bold mt-1 hover:text-blue-600 transition-colors"
                                    >
                                        Change Profile Photo
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Professional List-style Settings */}
                        <div className="max-w-3xl mx-auto px-4 sm:px-0 pb-12">
                            {/* General Section */}
                            <div className="bg-white dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800">
                                <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
                                    <label className="text-[13px] font-semibold text-slate-900 dark:text-white w-24 shrink-0">Name</label>
                                    <Input
                                        value={profileName}
                                        onChange={(e) => setProfileName(e.target.value)}
                                        className="flex-1 bg-transparent border-none p-0 h-auto focus:ring-0 text-[13px] text-slate-600 dark:text-slate-400 font-medium"
                                        placeholder="Name"
                                    />
                                </div>
                                <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
                                    <label className="text-[13px] font-semibold text-slate-900 dark:text-white w-24 shrink-0">Bio</label>
                                    <textarea
                                        value={profileBio}
                                        onChange={(e) => setProfileBio(e.target.value)}
                                        rows={1}
                                        placeholder="Bio"
                                        className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-[13px] text-slate-600 dark:text-slate-400 font-medium resize-none leading-normal min-h-[20px]"
                                    />
                                </div>
                                <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
                                    <label className="text-[13px] font-semibold text-slate-900 dark:text-white w-24 shrink-0">LinkedIn</label>
                                    <Input
                                        value={profileLinkedin}
                                        onChange={(e) => setProfileLinkedin(e.target.value)}
                                        placeholder="LinkedIn URL"
                                        className="flex-1 bg-transparent border-none p-0 h-auto focus:ring-0 text-[13px] text-slate-600 dark:text-slate-400 font-medium"
                                    />
                                </div>
                                <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
                                    <label className="text-[13px] font-semibold text-slate-900 dark:text-white w-24 shrink-0">GitHub</label>
                                    <Input
                                        value={profileGithub}
                                        onChange={(e) => setProfileGithub(e.target.value)}
                                        placeholder="GitHub URL"
                                        className="flex-1 bg-transparent border-none p-0 h-auto focus:ring-0 text-[13px] text-slate-600 dark:text-slate-400 font-medium"
                                    />
                                </div>
                                <div className="flex items-center px-4 py-3.5">
                                    <label className="text-[13px] font-semibold text-slate-900 dark:text-white w-24 shrink-0">Website</label>
                                    <Input
                                        value={profilePortfolio}
                                        onChange={(e) => setProfilePortfolio(e.target.value)}
                                        placeholder="Website URL"
                                        className="flex-1 bg-transparent border-none p-0 h-auto focus:ring-0 text-[13px] text-slate-600 dark:text-slate-400 font-medium"
                                    />
                                </div>
                            </div>

                            {/* Private Info Section */}
                            <div className="mt-8 px-4 mb-2">
                                <h3 className="text-[13px] font-bold text-slate-400 dark:text-slate-500">Private Information</h3>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800">
                                <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
                                    <label className="text-[13px] font-semibold text-slate-900 dark:text-white w-24 shrink-0">Email</label>
                                    <span className="flex-1 text-[13px] text-slate-400 font-medium">{user.email}</span>
                                </div>
                                {user.role === 'Student' && (
                                    <div className="flex items-center px-4 py-3.5">
                                        <label className="text-[13px] font-semibold text-slate-900 dark:text-white w-24 shrink-0">ID</label>
                                        <span className="flex-1 text-[13px] text-slate-400 font-medium">{user.email?.split('@')[0].substring(0, 10)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SettingsPanel>
                );
            case 'security':
                return (
                    <SettingsPanel
                        title="Password & Security"
                        description="Change your password and manage your account's security."
                        footer={
                            <div className="w-full flex flex-col gap-3">
                                {passwordSaveMessage && (
                                    <p className={`text-xs font-bold text-center sm:text-left ${passwordSaveMessage.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                                        {passwordSaveMessage}
                                    </p>
                                )}
                                <Button
                                    onClick={handleUpdatePassword}
                                    disabled={isPasswordUpdateDisabled || isUpdatingPassword}
                                    className="w-full sm:w-auto sm:px-8 h-12 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20 rounded-xl"
                                >
                                    {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                                </Button>
                            </div>
                        }
                    >
                        <Input
                            label="Current Password"
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            endIcon={showCurrentPassword ? ICONS.eyeOff : ICONS.eye}
                            onEndIconClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        />
                        <div>
                            <Input
                                label="New Password"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                endIcon={showNewPassword ? ICONS.eyeOff : ICONS.eye}
                                onEndIconClick={() => setShowNewPassword(!showNewPassword)}
                            />
                            {passwordErrors.newPassword && <p className="text-sm text-red-500 mt-1">{passwordErrors.newPassword}</p>}
                        </div>
                        <div>
                            <Input
                                label="Confirm New Password"
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                endIcon={showConfirmPassword ? ICONS.eyeOff : ICONS.eye}
                                onEndIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            />
                            {passwordErrors.confirmPassword && <p className="text-sm text-red-500 mt-1">{passwordErrors.confirmPassword}</p>}
                        </div>
                    </SettingsPanel>
                );
            case 'appearance':
                return (
                    <SettingsPanel
                        title="Appearance"
                        description="Customize how the KLIAS platform looks on your device."
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex-1 flex flex-col gap-0.5">
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Dark Mode</h3>
                                <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 font-medium">Switch between light and dark themes.</p>
                            </div>
                            <div className="shrink-0">
                                <ToggleSwitch
                                    checked={theme === Theme.DARK}
                                    onChange={toggleTheme}
                                />
                            </div>
                        </div>
                    </SettingsPanel>
                );
            case 'danger':
                return (
                    <SettingsPanel
                        title="Danger Zone"
                        description="These actions are irreversible. Please proceed with caution."
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex-1 space-y-0.5">
                                <h3 className="font-bold text-sm sm:text-base text-red-600 dark:text-red-400">Delete Account</h3>
                                <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Permanently delete your account and all of your content. This action is irreversible.</p>
                            </div>
                            <Button className="shrink-0 whitespace-nowrap w-full sm:w-auto bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white font-bold rounded-xl h-11 px-8 text-xs sm:text-sm">Delete Account</Button>
                        </div>
                    </SettingsPanel>
                );
            default:
                return null;
        }
    };

    const selectedMobileCategory = settingsNav.find(nav => nav.id === mobileView);

    return (
        <>
            {/* MOBILE VIEW */}
            <div className="md:hidden min-h-screen bg-slate-50/50 dark:bg-slate-900/50 pt-4 pb-20">
                {mobileView === 'menu' ? (
                    // Mobile Menu View
                    <div className="max-w-lg mx-auto">
                        <div className="flex items-center gap-4 mb-6 px-4">
                            <button
                                onClick={handleBack}
                                className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
                        </div>

                        <div className="space-y-6 px-4">
                            {/* General Settings Group */}
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-2">Account & Display</h3>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                    {settingsNav.map((item, index) => (
                                        <React.Fragment key={item.id}>
                                            <button
                                                onClick={() => setMobileView(item.id)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 dark:active:bg-slate-700 transition-all text-left group"
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <span className="text-slate-500 dark:text-slate-400 group-active:scale-95 transition-transform">{item.icon}</span>
                                                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{item.label}</span>
                                                </div>
                                                <span className="text-slate-400 dark:text-slate-500">
                                                    {React.cloneElement(ICONS.chevronRight, { className: "h-4 w-4" })}
                                                </span>
                                            </button>
                                            {index < settingsNav.length - 1 && (
                                                <div className="h-px bg-slate-100 dark:bg-slate-700/50 mx-4" />
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* Session Group */}
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-2">Session</h3>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                    <button
                                        onClick={logout}
                                        className="w-full flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-900/10 active:bg-red-100 dark:active:bg-red-900/20 transition-all text-left"
                                    >
                                        <div className="flex items-center space-x-4">
                                            <span className="text-red-500 dark:text-red-400">
                                                {React.cloneElement(ICONS.logout as React.ReactElement, { className: "h-5 w-5" })}
                                            </span>
                                            <span className="font-semibold text-sm text-red-500 dark:text-red-400">Logout</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Mobile Detail View
                    <div className="max-w-lg mx-auto">
                        <div className="flex items-center gap-4 mb-8 px-4">
                            <button
                                onClick={handleMobileBackToMenu}
                                className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedMobileCategory?.label}</h1>
                        </div>
                        <div className="px-0">
                            {renderContent(mobileView)}
                        </div>
                    </div>
                )}
            </div>

            {/* DESKTOP VIEW */}
            <div className="hidden md:flex flex-row h-screen bg-white dark:bg-slate-900 overflow-hidden">
                <aside className="w-[280px] p-6 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900">
                    <h1 className="text-3xl font-bold mb-6">Settings</h1>
                    <nav>
                        <ul className="space-y-2">
                            {settingsNav.map(item => {
                                const isActive = activeCategory === item.id;
                                const itemClasses = `w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                                    ${isActive
                                        ? 'bg-red-600 text-white shadow-md transform scale-[1.02]'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                    }`;
                                const iconColor = isActive ? 'text-white' : 'text-slate-400';

                                return (
                                    <li key={item.id}>
                                        <button onClick={() => setActiveCategory(item.id)} className={itemClasses}>
                                            <span className={iconColor}>{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </aside>

                <main className="flex-1 h-full overflow-hidden bg-white dark:bg-slate-900">
                    <div className="h-full max-w-4xl mx-auto py-8 px-8 overflow-y-auto custom-scrollbar">
                        {renderContent(activeCategory)}
                    </div>
                </main>
            </div>

            {/* OTP Verification Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-[400px] rounded-[40px] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-white/20 dark:border-slate-800/50 animate-in zoom-in-95 duration-300">
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Verify Identity</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm leading-relaxed px-4">
                                We've sent a 6-digit code to your email. Please enter it below to confirm your password change.
                            </p>
                        </div>

                        <div className="space-y-8">
                            <div className="relative">
                                <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 text-center">Security Code</label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={otpValue}
                                    onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                    className="w-full text-center text-4xl font-mono font-medium tracking-[0.4em] py-6 rounded-[24px] bg-slate-50 dark:bg-slate-800/50 border-none focus:ring-2 focus:ring-red-500/50 text-slate-900 dark:text-white placeholder-slate-200 dark:placeholder-slate-800 transition-all duration-300"
                                />
                            </div>

                            <div className="flex flex-col gap-4">
                                <Button
                                    onClick={handleVerifyOtp}
                                    disabled={otpValue.length !== 6 || isVerifyingOtp}
                                    className="w-full h-16 bg-red-600 hover:bg-red-700 text-white font-bold rounded-[24px] shadow-xl shadow-red-500/20 active:scale-[0.98] transition-all duration-200 text-lg"
                                >
                                    {isVerifyingOtp ? 'Verifying...' : 'Confirm Change'}
                                </Button>
                                <button
                                    onClick={() => setShowOtpModal(false)}
                                    className="w-full py-2 text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};