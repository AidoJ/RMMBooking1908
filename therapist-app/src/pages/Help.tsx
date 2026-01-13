import React, { useState } from 'react';
import { Card, Collapse, Typography, Space, Divider, Tag, Button } from 'antd';
import {
  DashboardOutlined,
  CalendarOutlined,
  FileTextOutlined,
  UserOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

// Video Player Component - uses BASE_URL for correct path in production
const VideoPlayer: React.FC<{ videoSrc: string }> = ({ videoSrc }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Get base URL from Vite (will be '/therapist/' in production)
  const baseUrl = import.meta.env.BASE_URL || '/';
  const fullVideoPath = `${baseUrl}${videoSrc}`;

  return (
    <div style={{ marginBottom: 24 }}>
      <Button
        type="dashed"
        size="large"
        icon={isExpanded ? <UpOutlined /> : <PlayCircleOutlined />}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          height: 'auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isExpanded ? '#e6f7ff' : '#fafafa',
          borderColor: isExpanded ? '#1890ff' : '#d9d9d9',
        }}
      >
        <Space>
          <PlayCircleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Text strong style={{ fontSize: 16 }}>
            {isExpanded ? 'Hide Video Tutorial' : 'Watch Video Tutorial'}
          </Text>
        </Space>
        {isExpanded ? <UpOutlined /> : <DownOutlined />}
      </Button>

      {isExpanded && (
        <div style={{
          marginTop: 12,
          border: '2px solid #1890ff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {videoError ? (
            <div style={{ padding: 20, textAlign: 'center', backgroundColor: '#fff2f0', color: '#cf1322' }}>
              <WarningOutlined style={{ fontSize: 24, marginBottom: 8 }} />
              <p>Unable to load video. Please try refreshing the page.</p>
            </div>
          ) : (
            <video
              controls
              style={{ width: '100%', display: 'block', backgroundColor: '#000' }}
              preload="metadata"
              onError={() => {
                console.error('Video failed to load:', fullVideoPath);
                setVideoError(true);
              }}
            >
              <source src={fullVideoPath} type="video/webm" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      )}

      {isExpanded && <Divider />}
    </div>
  );
};

export const Help: React.FC = () => {
  return (
    <div>
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #007e8c 0%, #1FBFBF 100%)', border: 'none' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            <QuestionCircleOutlined /> Therapist Portal Help Guide
          </Title>
          <Text style={{ color: 'white', fontSize: 16 }}>
            Welcome to the Rejuvenators Therapist Portal! This guide will help you understand how to use each feature of the portal.
          </Text>
        </Space>
      </Card>

      <Card>
        <Collapse accordion defaultActiveKey={['1']} size="large">
          {/* Dashboard */}
          <Panel
            header={
              <Space>
                <DashboardOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>Dashboard</Text>
              </Space>
            }
            key="1"
          >
            <VideoPlayer videoSrc="videos/Dashboard.webm" />

            <Title level={4}>What is the Dashboard?</Title>
            <Paragraph>
              The Dashboard is your home page and provides a quick overview of your bookings and earnings at a glance.
            </Paragraph>

            <Title level={5}>Key Features:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>• Statistics Cards</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  View important metrics including:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><strong>Today's Jobs:</strong> Number of bookings scheduled for today</li>
                  <li><strong>Requested Jobs:</strong> Bookings awaiting your response (shown with gold/yellow badge)</li>
                  <li><strong>Pending Jobs:</strong> Quoted jobs waiting for customer confirmation</li>
                  <li><strong>This Week:</strong> Total bookings for the current week</li>
                  <li><strong>Today's Earnings:</strong> Money earned from completed jobs today</li>
                  <li><strong>Week's Earnings:</strong> Total earnings for the current week</li>
                </ul>
              </div>

              <div>
                <Text strong>• Quick Action Buttons</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Fast access to commonly used sections: Calendar, My Earnings, My Bookings, and Invoices
                </Paragraph>
              </div>

              <div>
                <Text strong>• Certificate Status <Tag color="orange">Important!</Tag></Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Monitor your Insurance and First Aid certificate expiry dates:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><Tag color="green" icon={<CheckCircleOutlined />}>OK</Tag> - Certificate valid for more than 30 days</li>
                  <li><Tag color="orange" icon={<WarningOutlined />}>Expiring</Tag> - Expires within 30 days</li>
                  <li><Tag color="red" icon={<InfoCircleOutlined />}>Expired</Tag> - Certificate has expired</li>
                </ul>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click the "Update" button to upload new certificates in your Profile page.
                </Paragraph>
              </div>

              <div>
                <Text strong>• Today's Bookings</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  See all jobs scheduled for today with customer name, service type, time, location, and your fee.
                  Click on any booking to view full details.
                </Paragraph>
              </div>

              <div>
                <Text strong>• Upcoming Bookings</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Preview your next 5 bookings over the following 7 days.
                  Click to view details and prepare for upcoming jobs.
                </Paragraph>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Understanding Booking Status Tags:</Title>
            <Space wrap style={{ marginTop: 12 }}>
              <Tag color="orange" style={{ backgroundColor: '#FFD700', color: '#000', fontWeight: 'bold' }}>REQUESTED</Tag>
              <Text>New booking request - requires your response</Text>
            </Space>
            <br />
            <Space wrap style={{ marginTop: 8 }}>
              <Tag color="blue">CONFIRMED</Tag>
              <Text>Booking confirmed and scheduled</Text>
            </Space>
            <br />
            <Space wrap style={{ marginTop: 8 }}>
              <Tag color="green">COMPLETED</Tag>
              <Text>Job completed successfully</Text>
            </Space>
          </Panel>

          {/* Calendar */}
          <Panel
            header={
              <Space>
                <CalendarOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>Calendar</Text>
              </Space>
            }
            key="2"
          >
            <VideoPlayer videoSrc="videos/Calendar and My Bookings.webm" />

            <Title level={4}>What is the Calendar?</Title>
            <Paragraph>
              The Calendar provides a visual overview of all your bookings in a month/week/day view format.
            </Paragraph>

            <Title level={5}>Key Features:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>• Multiple Views</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Switch between Month, Week, and Day views to see your schedule at different levels of detail.
                </Paragraph>
              </div>

              <div>
                <Text strong>• Color-Coded Events</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Bookings are color-coded by status for easy identification:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><strong>Gold/Yellow:</strong> Requested (needs your response)</li>
                  <li><strong>Blue:</strong> Confirmed</li>
                  <li><strong>Green:</strong> Completed</li>
                  <li><strong>Red:</strong> Cancelled or Declined</li>
                </ul>
              </div>

              <div>
                <Text strong>• Event Details</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Each calendar event shows:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Customer name</li>
                  <li>Service type</li>
                  <li>Time of booking</li>
                  <li>Session number (for recurring bookings)</li>
                </ul>
              </div>

              <div>
                <Text strong>• Click to View</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click any booking on the calendar to view full details and take actions (accept/decline, update status, etc.)
                </Paragraph>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Tips:</Title>
            <ul>
              <li>Use Month view for long-term planning</li>
              <li>Use Week view to see your weekly schedule at a glance</li>
              <li>Use Day view when you have multiple bookings in one day</li>
              <li>The calendar loads 3 months before and after the current date</li>
            </ul>
          </Panel>

          {/* My Bookings */}
          <Panel
            header={
              <Space>
                <FileTextOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>My Bookings</Text>
              </Space>
            }
            key="3"
          >
            <VideoPlayer videoSrc="videos/Calendar and My Bookings.webm" />

            <Title level={4}>What is My Bookings?</Title>
            <Paragraph>
              My Bookings shows a detailed table of all your bookings with powerful filtering and sorting options.
            </Paragraph>

            <Title level={5}>Key Features:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>• Comprehensive Table View</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  See all booking details in one place:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><strong>Booking ID:</strong> Unique identifier for each booking</li>
                  <li><strong>Date & Time:</strong> When the service is scheduled</li>
                  <li><strong>Customer:</strong> Customer name and contact</li>
                  <li><strong>Service:</strong> Type of therapy booked</li>
                  <li><strong>Location:</strong> Address where service will be provided</li>
                  <li><strong>Duration:</strong> Length of session in minutes</li>
                  <li><strong>Status:</strong> Current booking status</li>
                  <li><strong>Fee:</strong> Your earnings for this booking</li>
                </ul>
              </div>

              <div>
                <Text strong>• Status Filter</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Use the dropdown at the top to filter bookings by status:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><strong>All Statuses:</strong> Show everything</li>
                  <li><strong>Confirmed:</strong> Only show confirmed bookings</li>
                  <li><strong>Completed:</strong> View your finished jobs</li>
                  <li><strong>Requested:</strong> See bookings awaiting your response</li>
                  <li><strong>Pending:</strong> View quoted jobs waiting for customer</li>
                  <li><strong>Cancelled:</strong> See cancelled bookings</li>
                </ul>
              </div>

              <div>
                <Text strong>• Sorting</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click column headers to sort by date, fee amount, or status.
                </Paragraph>
              </div>

              <div>
                <Text strong>• View Details</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click the "View" button on any booking to see full details, customer intake form, and take actions.
                </Paragraph>
              </div>
            </Space>

            <Divider />
            <Title level={5}>What to Do with Different Statuses:</Title>
            <ul>
              <li><Tag color="orange" style={{ backgroundColor: '#FFD700', color: '#000' }}>REQUESTED</Tag> - Open the booking and click "Accept" or "Decline"</li>
              <li><Tag color="red">PENDING</Tag> - Wait for customer to accept your quote</li>
              <li><Tag color="blue">CONFIRMED</Tag> - Job is locked in, prepare for the appointment</li>
              <li><Tag color="green">COMPLETED</Tag> - Job done! Will appear in your earnings</li>
            </ul>
          </Panel>

          {/* My Profile */}
          <Panel
            header={
              <Space>
                <UserOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>My Profile</Text>
              </Space>
            }
            key="4"
          >
            <VideoPlayer videoSrc="videos/My profile.webm" />

            <Title level={4}>What is My Profile?</Title>
            <Paragraph>
              Your Profile contains all your personal, business, and compliance information. Keep this up to date!
            </Paragraph>

            <Title level={5}>Sections in Your Profile:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>• Personal Information</Text>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Profile Photo:</strong> Upload a professional photo (customers see this!)</li>
                  <li><strong>Name:</strong> First and last name</li>
                  <li><strong>Contact Details:</strong> Email and phone number</li>
                  <li><strong>Gender:</strong> Optional demographic information</li>
                  <li><strong>Years of Experience:</strong> Show your expertise level</li>
                </ul>
              </div>

              <div>
                <Text strong>• Business Information</Text>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Business ABN:</strong> Required - must be exactly 11 digits (no spaces)</li>
                  <li><strong>Timezone:</strong> Your service area timezone for accurate scheduling</li>
                  <li><strong>Bio:</strong> Tell customers about yourself, specialties, and approach to therapy</li>
                </ul>
              </div>

              <div>
                <Text strong>• Certificates & Compliance <Tag color="orange">Important!</Tag></Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  You MUST keep these up to date to receive bookings:
                </Paragraph>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Insurance Certificate:</strong> Upload PDF/image and set expiry date</li>
                  <li><strong>First Aid Certificate:</strong> Upload PDF/image and set expiry date</li>
                  <li><strong>Therapist Qualifications:</strong> Upload your massage therapy certificates</li>
                </ul>
                <Paragraph style={{ marginLeft: 20, marginTop: 8, color: '#ff4d4f' }}>
                  <WarningOutlined /> You'll receive warnings 30 days before expiry. Keep certificates current!
                </Paragraph>
              </div>

              <div>
                <Text strong>• Banking Details</Text>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Bank Account Name:</strong> Account holder name</li>
                  <li><strong>BSB:</strong> Bank branch identifier (format: XXX-XXX)</li>
                  <li><strong>Account Number:</strong> Your bank account number</li>
                  <li>These details are used for payment of your invoices</li>
                </ul>
              </div>

              <div>
                <Text strong>• Hourly Rates</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Your standard and after-hours rates are set by admin. These fields are read-only.
                </Paragraph>
              </div>

              <div>
                <Text strong>• Change Password</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  At the bottom of the profile page, you can update your login password.
                  Requirements:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>At least 8 characters</li>
                  <li>Must include uppercase letters</li>
                  <li>Must include lowercase letters</li>
                  <li>Must include numbers</li>
                </ul>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Important:</Title>
            <ul>
              <li>Click "Save Changes" at the bottom after making any updates</li>
              <li>Upload certificates as soon as you receive renewed ones</li>
              <li>Keep your contact information current so customers can reach you</li>
              <li>Your bio is visible to customers - make it engaging!</li>
            </ul>
          </Panel>

          {/* My Services */}
          <Panel
            header={
              <Space>
                <FileTextOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>My Services</Text>
              </Space>
            }
            key="5"
          >
            <VideoPlayer videoSrc="videos/My Services.webm" />

            <Title level={4}>What is My Services?</Title>
            <Paragraph>
              My Services lets you select which types of massage therapy services you offer from the available list.
            </Paragraph>

            <Title level={5}>How to Use:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>1. View Available Services</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  See all services that Rejuvenators offers, including descriptions and base pricing.
                </Paragraph>
              </div>

              <div>
                <Text strong>2. Add Services</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click the <Tag color="blue"><PlusOutlined /> Add</Tag> button next to any service you're qualified to provide.
                  Services you offer will move to the "Your Current Services" section.
                </Paragraph>
              </div>

              <div>
                <Text strong>3. Remove Services</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click the <Tag color="red"><DeleteOutlined /> Remove</Tag> button to stop offering a service.
                </Paragraph>
              </div>

              <div>
                <Text strong>4. Save Changes</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click the "Save Changes" button at the bottom to apply your selections.
                </Paragraph>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Tips:</Title>
            <ul>
              <li>Only add services you're qualified and comfortable providing</li>
              <li>More services = more booking opportunities</li>
              <li>You can change your services anytime</li>
              <li>Customers will only see you for the services you've selected</li>
            </ul>
          </Panel>

          {/* Availability */}
          <Panel
            header={
              <Space>
                <ClockCircleOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>Availability</Text>
              </Space>
            }
            key="6"
          >
            <VideoPlayer videoSrc="videos/Availability.webm" />

            <Title level={4}>What is Availability?</Title>
            <Paragraph>
              Set your recurring weekly work schedule so customers know when you're available for bookings.
            </Paragraph>

            <Title level={5}>How to Set Availability:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>1. Add Time Slots</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click "Add Availability Slot" button and:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Select the day of week (Monday - Sunday)</li>
                  <li>Choose start time</li>
                  <li>Choose end time</li>
                  <li>Click "Add" to save</li>
                </ul>
              </div>

              <div>
                <Text strong>2. Multiple Slots Per Day</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  You can add multiple time slots for the same day if you have split shifts.
                  Example: Monday 9:00 AM - 12:00 PM AND Monday 2:00 PM - 6:00 PM
                </Paragraph>
              </div>

              <div>
                <Text strong>3. Delete Time Slots</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click the red Delete button next to any slot to remove it from your schedule.
                </Paragraph>
              </div>

              <div>
                <Text strong>4. Overlap Protection</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  The system won't let you create overlapping time slots for the same day.
                </Paragraph>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Important Notes:</Title>
            <ul>
              <li>This sets your RECURRING weekly schedule (repeats every week)</li>
              <li>For one-off unavailability, use the Time Off page instead</li>
              <li>Availability slots apply to all weeks unless blocked by Time Off</li>
              <li>Customers can only request bookings during your available times</li>
              <li>Update regularly if your schedule changes</li>
            </ul>
          </Panel>

          {/* Time Off */}
          <Panel
            header={
              <Space>
                <ClockCircleOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>Time Off</Text>
              </Space>
            }
            key="7"
          >
            <VideoPlayer videoSrc="videos/Time Off.webm" />

            <Title level={4}>What is Time Off?</Title>
            <Paragraph>
              Block out specific dates or date ranges when you're unavailable (holidays, sick leave, personal time, etc.)
            </Paragraph>

            <Title level={5}>How to Block Time Off:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>1. Click "Add Time Off"</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Opens a form to create a new time off period.
                </Paragraph>
              </div>

              <div>
                <Text strong>2. Select Date Range</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Choose start and end dates. You can block:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Single day (same start and end date)</li>
                  <li>Multiple days (date range)</li>
                  <li>Whole days or specific time ranges</li>
                </ul>
              </div>

              <div>
                <Text strong>3. Optional: Specific Times</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  If you're only unavailable for part of a day, set start and end times.
                  Leave blank to block the entire day(s).
                </Paragraph>
              </div>

              <div>
                <Text strong>4. Add Reason (Optional)</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Note why you're unavailable (for your own reference - customers don't see this).
                </Paragraph>
              </div>

              <div>
                <Text strong>5. View & Delete</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  All time off periods are listed in a table. Click Delete to remove one if plans change.
                </Paragraph>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Important:</Title>
            <ul>
              <li>Set time off BEFORE customers try to book those dates</li>
              <li>Time off overrides your regular Availability schedule</li>
              <li>Customers cannot request bookings during blocked periods</li>
              <li>Plan ahead for holidays, vacations, and planned absences</li>
            </ul>
          </Panel>

          {/* Service Area */}
          <Panel
            header={
              <Space>
                <EnvironmentOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>Service Area</Text>
              </Space>
            }
            key="8"
          >
            <VideoPlayer videoSrc="videos/Service Area.webm" />

            <Title level={4}>What is Service Area?</Title>
            <Paragraph>
              Define the geographic area where you provide mobile massage services, based on your home address and service radius.
            </Paragraph>

            <Title level={5}>How to Set Your Service Area:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>1. Enter Home Address</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Type your home address. The system uses Google Maps autocomplete to verify the address.
                  Select from the dropdown suggestions to ensure accuracy.
                </Paragraph>
              </div>

              <div>
                <Text strong>2. Set Service Radius</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Enter how many kilometers you're willing to travel from your home address (e.g., 10 km, 20 km).
                  This creates a circular coverage area.
                </Paragraph>
              </div>

              <div>
                <Text strong>3. Visual Map Display</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  A map shows your service area as a shaded polygon. This helps you visualize your coverage.
                </Paragraph>
              </div>

              <div>
                <Text strong>4. Adjust the Polygon (Advanced)</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  You can manually adjust the service area boundaries on the map if you want to exclude certain areas
                  or create a custom shape.
                </Paragraph>
              </div>

              <div>
                <Text strong>5. Save Changes</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click "Save Service Area" to apply your settings.
                </Paragraph>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Important:</Title>
            <ul>
              <li>Customers can only book you if their address falls within your service area</li>
              <li>Be realistic about travel distance - factor in traffic and time</li>
              <li>Larger service area = more booking opportunities (but more travel)</li>
              <li>You must verify your address using the autocomplete suggestions</li>
              <li>Update if you move or want to expand/reduce your coverage</li>
            </ul>
          </Panel>

          {/* My Earnings */}
          <Panel
            header={
              <Space>
                <DollarOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>My Earnings</Text>
              </Space>
            }
            key="9"
          >
            <VideoPlayer videoSrc="videos/My Earnings.webm" />

            <Title level={4}>What is My Earnings?</Title>
            <Paragraph>
              Track your completed jobs and earnings by week, view daily breakdowns, and submit invoices for payment.
            </Paragraph>

            <Title level={5}>Key Features:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>• Monthly Summary</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  See total earnings and jobs completed for the current month.
                </Paragraph>
              </div>

              <div>
                <Text strong>• Weekly Earnings Table</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Shows last 12 weeks with:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><strong>Week Period:</strong> Start and end date</li>
                  <li><strong>Jobs Count:</strong> Number of completed jobs</li>
                  <li><strong>Total Fees:</strong> Total earnings for that week</li>
                  <li><strong>Invoice Status:</strong> Whether you've submitted an invoice</li>
                  <li><strong>Actions:</strong> View daily breakdown, submit invoice</li>
                </ul>
              </div>

              <div>
                <Text strong>• Daily Breakdown</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click "View Breakdown" to see day-by-day earnings within a week:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Date and jobs per day</li>
                  <li>Base fees and total earnings per day</li>
                  <li>Booking IDs for reference</li>
                </ul>
              </div>

              <div>
                <Text strong>• Submit Invoice <Tag color="blue">Payment Required</Tag></Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  To get paid, you must submit a weekly invoice:
                </Paragraph>
                <ol style={{ marginLeft: 40 }}>
                  <li>Click "Submit Invoice" for a completed week</li>
                  <li>Enter your invoice number</li>
                  <li>Enter invoice date</li>
                  <li>Enter the total fee amount you're claiming</li>
                  <li>Upload your invoice PDF</li>
                  <li>Optional: Add parking costs with receipt</li>
                  <li>Optional: Add notes for admin</li>
                  <li>Submit for review</li>
                </ol>
              </div>

              <div>
                <Text strong>• Invoice Status Tracking</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  After submission, track your invoice status:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><Tag color="blue">SUBMITTED</Tag> - Admin is reviewing</li>
                  <li><Tag color="orange">UNDER REVIEW</Tag> - Being processed</li>
                  <li><Tag color="green">APPROVED</Tag> - Approved for payment</li>
                  <li><Tag color="green">PAID</Tag> - Payment has been made to your account</li>
                </ul>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Important:</Title>
            <ul>
              <li>You MUST submit an invoice to receive payment for completed jobs</li>
              <li>Submit invoices weekly for timely payments</li>
              <li>Double-check your claimed amount matches the calculated fees</li>
              <li>Include parking receipts if claiming parking costs</li>
              <li>Only completed jobs count towards earnings</li>
              <li>Check the Invoices page to view submitted invoices and payment details</li>
            </ul>
          </Panel>

          {/* Invoices */}
          <Panel
            header={
              <Space>
                <FileTextOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>Invoices</Text>
              </Space>
            }
            key="10"
          >
            <VideoPlayer videoSrc="videos/Invoices.webm" />

            <Title level={4}>What is Invoices?</Title>
            <Paragraph>
              View all your submitted invoices, track their status, see admin reviews, and monitor payments.
            </Paragraph>

            <Title level={5}>Invoice Information Displayed:</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>• Invoice Details</Text>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Week Period:</strong> Which week this invoice covers</li>
                  <li><strong>Your Invoice Number:</strong> Your reference number</li>
                  <li><strong>Invoice Date:</strong> Date you created the invoice</li>
                  <li><strong>Job Count:</strong> Number of jobs in this invoice</li>
                  <li><strong>Status:</strong> Current processing stage</li>
                </ul>
              </div>

              <div>
                <Text strong>• Financial Breakdown</Text>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Calculated Fees:</strong> System-calculated total from completed jobs</li>
                  <li><strong>Your Claimed Fees:</strong> Amount you invoiced</li>
                  <li><strong>Parking Amount:</strong> Parking costs you claimed</li>
                  <li><strong>Total Claimed:</strong> Total amount you're requesting</li>
                  <li><strong>Variance:</strong> Difference between calculated and claimed (if any)</li>
                </ul>
              </div>

              <div>
                <Text strong>• Admin Review</Text>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Approved Fees:</strong> Amount admin approved for payment</li>
                  <li><strong>Approved Parking:</strong> Parking costs admin approved</li>
                  <li><strong>Total Approved:</strong> Total approved for payment</li>
                  <li><strong>Admin Notes:</strong> Any comments or adjustments explained</li>
                </ul>
              </div>

              <div>
                <Text strong>• Payment Information</Text>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Paid Amount:</strong> Actual amount transferred to you</li>
                  <li><strong>Payment Date:</strong> When payment was made</li>
                  <li><strong>EFT Reference:</strong> Bank transfer reference number</li>
                </ul>
              </div>

              <div>
                <Text strong>• View Full Details</Text>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Click "View" on any invoice to see:
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Your uploaded invoice PDF</li>
                  <li>Parking receipt (if uploaded)</li>
                  <li>Individual booking IDs included</li>
                  <li>Complete financial breakdown</li>
                  <li>Full admin notes and review details</li>
                </ul>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Invoice Status Meanings:</Title>
            <ul>
              <li><Tag>DRAFT</Tag> - Not yet submitted</li>
              <li><Tag color="blue">SUBMITTED</Tag> - Admin has received it</li>
              <li><Tag color="orange">UNDER REVIEW</Tag> - Admin is checking details</li>
              <li><Tag color="green">APPROVED</Tag> - Approved, payment pending</li>
              <li><Tag color="green">PAID</Tag> - Money has been paid to your account</li>
              <li><Tag color="red">DISPUTED</Tag> - Issue to resolve with admin</li>
              <li><Tag color="red">REJECTED</Tag> - Not approved, resubmission needed</li>
            </ul>

            <Divider />
            <Title level={5}>What to Do if There's a Variance:</Title>
            <Paragraph>
              A variance occurs when your claimed amount doesn't match the system calculation. This could be due to:
            </Paragraph>
            <ul>
              <li>Additional fees agreed with customer (note in comments)</li>
              <li>Tip or bonus received</li>
              <li>Calculation error (check your math)</li>
              <li>Missing or duplicate bookings (check booking IDs)</li>
            </ul>
            <Paragraph style={{ marginTop: 12 }}>
              Always explain variances in the Notes field when submitting. Admin will review and may contact you.
            </Paragraph>
          </Panel>

          {/* How Booking Requests Work */}
          <Panel
            header={
              <Space>
                <CheckCircleOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>How Booking Requests Work</Text>
              </Space>
            }
            key="11"
          >
            <Title level={4}>Understanding the Booking Process</Title>
            <Paragraph>
              When a customer requests a booking, here's what happens and what you need to do.
            </Paragraph>

            <Title level={5}>Step-by-Step Process:</Title>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px', backgroundColor: '#FFD700', color: '#000' }}>STEP 1: REQUESTED</Tag>
                <Paragraph style={{ marginTop: 12, marginLeft: 20 }}>
                  <strong>Customer requests a booking</strong>
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>You receive a notification</li>
                  <li>Booking appears with <Tag color="warning" style={{ backgroundColor: '#FFD700', color: '#000' }}>REQUESTED</Tag> status (gold/yellow)</li>
                  <li>Shows on Dashboard in "Requested Jobs" count</li>
                  <li><strong>Response time required:</strong>
                    <ul>
                      <li>Same-day bookings: 60 minutes</li>
                      <li>All other bookings: 4 hours</li>
                    </ul>
                  </li>
                </ul>
              </div>

              <div>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 2: YOUR RESPONSE</Tag>
                <Paragraph style={{ marginTop: 12, marginLeft: 20 }}>
                  <strong>Open the booking and review details:</strong>
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Date, time, and location</li>
                  <li>Service requested</li>
                  <li>Customer information</li>
                  <li>Customer's intake form (health conditions, allergies, preferences)</li>
                  <li>Your fee for this booking</li>
                </ul>
                <Paragraph style={{ marginTop: 12, marginLeft: 20 }}>
                  <strong>Two options:</strong>
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><Tag color="green">ACCEPT</Tag> - You can do the booking → Status changes to <Tag color="blue">CONFIRMED</Tag></li>
                  <li><Tag color="red">DECLINE</Tag> - You're unavailable or can't do it → Booking marked as <Tag color="red">DECLINED</Tag></li>
                </ul>
              </div>

              <div>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 3: CONFIRMED</Tag>
                <Paragraph style={{ marginTop: 12, marginLeft: 20 }}>
                  <strong>After you accept:</strong>
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Customer receives confirmation</li>
                  <li>Booking locked in on your calendar</li>
                  <li>Prepare for the appointment</li>
                  <li>Review customer's intake form again before attending</li>
                </ul>
              </div>

              <div>
                <Tag color="cyan" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 4: DAY OF BOOKING</Tag>
                <Paragraph style={{ marginTop: 12, marginLeft: 20 }}>
                  <strong>Update status as you go:</strong>
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li><strong>"On My Way":</strong> Click when you leave for the booking</li>
                  <li><strong>"I've Arrived":</strong> Click when you reach the location</li>
                  <li><strong>"Complete Job":</strong> Click when service is finished</li>
                </ul>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  These status updates notify the customer and help track your progress.
                </Paragraph>
              </div>

              <div>
                <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 5: COMPLETED</Tag>
                <Paragraph style={{ marginTop: 12, marginLeft: 20 }}>
                  <strong>After marking as complete:</strong>
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Booking status changes to <Tag color="green">COMPLETED</Tag></li>
                  <li>Job appears in your earnings for that week</li>
                  <li>Fee is included in weekly total</li>
                  <li>At end of week, submit invoice to get paid</li>
                </ul>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Special Case: Pending (Quoted) Bookings</Title>
            <Paragraph>
              Some bookings may show as <Tag color="red">PENDING</Tag> instead of REQUESTED:
            </Paragraph>
            <ul>
              <li>This means the customer requested a quote first</li>
              <li>Quote has been sent to customer</li>
              <li>Waiting for customer to accept the quote</li>
              <li>You don't need to do anything - just wait</li>
              <li>Once customer accepts, it will change to CONFIRMED</li>
            </ul>

            <Divider />
            <Title level={5}>Important Tips:</Title>
            <ul>
              <li>Respond to requests quickly (60 minutes for same-day bookings, 4 hours for all others)</li>
              <li>Check customer intake form BEFORE accepting</li>
              <li>Decline if you're not qualified for the specific health conditions mentioned</li>
              <li>Update status during the booking so customer knows your progress</li>
              <li>Add therapist notes after the session for your records</li>
              <li>Mark as complete ASAP after finishing so it counts in your earnings</li>
            </ul>
          </Panel>

          {/* Getting Paid */}
          <Panel
            header={
              <Space>
                <DollarOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>Getting Paid - Complete Guide</Text>
              </Space>
            }
            key="12"
          >
            <Title level={4}>How to Get Paid for Your Work</Title>
            <Paragraph>
              Follow this complete process to ensure you get paid for all your completed bookings.
            </Paragraph>

            <Title level={5}>Payment Process Overview:</Title>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 1: COMPLETE JOBS</Tag>
                <ul style={{ marginLeft: 20, marginTop: 12 }}>
                  <li>Provide the massage service</li>
                  <li>Mark booking as "Complete Job" when finished</li>
                  <li>Only <Tag color="green">COMPLETED</Tag> jobs count towards earnings</li>
                </ul>
              </div>

              <div>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 2: CHECK MY EARNINGS PAGE</Tag>
                <ul style={{ marginLeft: 20, marginTop: 12 }}>
                  <li>Go to "My Earnings" from the menu</li>
                  <li>See weekly summaries of completed jobs</li>
                  <li>Week runs Monday to Sunday</li>
                  <li>Wait until week is fully completed before invoicing</li>
                  <li>Click "View Breakdown" to see daily details</li>
                </ul>
              </div>

              <div>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 3: CREATE YOUR INVOICE</Tag>
                <Paragraph style={{ marginLeft: 20, marginTop: 12 }}>
                  <strong>Using your accounting software, create an invoice that includes:</strong>
                </Paragraph>
                <ul style={{ marginLeft: 40 }}>
                  <li>Your business name and ABN</li>
                  <li>Rejuvenators business details</li>
                  <li>Invoice number (your own reference system)</li>
                  <li>Invoice date</li>
                  <li>Week period being invoiced (e.g., "Week of Dec 4-10, 2023")</li>
                  <li>Line items for each booking OR total for the week</li>
                  <li>Parking costs (if applicable, itemized)</li>
                  <li>GST (if registered)</li>
                  <li>Total amount</li>
                </ul>
                <Paragraph style={{ marginLeft: 20, marginTop: 8 }}>
                  Save as PDF
                </Paragraph>
              </div>

              <div>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 4: SUBMIT INVOICE IN PORTAL</Tag>
                <Paragraph style={{ marginLeft: 20, marginTop: 12 }}>
                  <strong>In My Earnings page:</strong>
                </Paragraph>
                <ol style={{ marginLeft: 40 }}>
                  <li>Find the completed week</li>
                  <li>Click "Submit Invoice" button</li>
                  <li>Fill in the form:
                    <ul>
                      <li>Invoice Number (from your PDF)</li>
                      <li>Invoice Date</li>
                      <li>Total Fees (should match system calculation)</li>
                      <li>Upload your invoice PDF</li>
                      <li>Parking Amount (if applicable)</li>
                      <li>Upload parking receipt PDF/image (if claiming parking)</li>
                      <li>Notes (explain any variances or special circumstances)</li>
                    </ul>
                  </li>
                  <li>Click "Submit Invoice"</li>
                </ol>
              </div>

              <div>
                <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 5: ADMIN REVIEW</Tag>
                <ul style={{ marginLeft: 20, marginTop: 12 }}>
                  <li>Admin receives your invoice</li>
                  <li>Status shows <Tag color="blue">SUBMITTED</Tag> then <Tag color="orange">UNDER REVIEW</Tag></li>
                  <li>Admin verifies:
                    <ul>
                      <li>Bookings were completed</li>
                      <li>Fees match records</li>
                      <li>Parking costs are reasonable and receipted</li>
                    </ul>
                  </li>
                  <li>Admin may add notes if adjustments are needed</li>
                  <li>Status changes to <Tag color="green">APPROVED</Tag></li>
                </ul>
              </div>

              <div>
                <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>STEP 6: PAYMENT</Tag>
                <ul style={{ marginLeft: 20, marginTop: 12 }}>
                  <li>Admin processes EFT payment to your bank account</li>
                  <li>Payment usually within 7-14 business days of approval</li>
                  <li>Check Invoices page to see:
                    <ul>
                      <li><Tag color="green">PAID</Tag> status</li>
                      <li>Paid amount</li>
                      <li>Payment date</li>
                      <li>EFT reference number</li>
                    </ul>
                  </li>
                  <li>Check your bank account for the transfer</li>
                </ul>
              </div>
            </Space>

            <Divider />
            <Title level={5}>Important Payment Rules:</Title>
            <ul>
              <li><strong>Invoice Weekly:</strong> Submit an invoice for each completed week</li>
              <li><strong>Don't Delay:</strong> Submit invoices promptly (within 1-2 weeks of week ending)</li>
              <li><strong>Match Calculations:</strong> Your claimed fees should match the system-calculated total</li>
              <li><strong>Explain Variances:</strong> If amounts don't match, explain why in Notes</li>
              <li><strong>Parking Receipts:</strong> Must provide receipt image for all parking claims</li>
              <li><strong>Check Banking Details:</strong> Ensure your banking details in Profile are correct</li>
              <li><strong>GST:</strong> If you're GST registered, include GST in your invoice</li>
              <li><strong>Track Status:</strong> Check Invoices page regularly to monitor processing</li>
            </ul>

            <Divider />
            <Title level={5}>What If There's a Problem?</Title>
            <Paragraph>
              <strong>Disputed or Rejected Invoice:</strong>
            </Paragraph>
            <ul>
              <li>Check admin notes in the Invoices page</li>
              <li>Admin will explain the issue</li>
              <li>Fix the problem (e.g., correct amount, add missing receipt)</li>
              <li>Resubmit if needed</li>
              <li>Contact admin if you have questions</li>
            </ul>

            <Paragraph style={{ marginTop: 16 }}>
              <strong>Payment Delayed:</strong>
            </Paragraph>
            <ul>
              <li>Check your invoice status first</li>
              <li>Ensure banking details are correct in Profile</li>
              <li>Contact admin if payment is overdue (more than 14 business days after approval)</li>
            </ul>
          </Panel>

          {/* Troubleshooting */}
          <Panel
            header={
              <Space>
                <InfoCircleOutlined style={{ fontSize: 20, color: '#007e8c' }} />
                <Text strong style={{ fontSize: 16 }}>Troubleshooting & FAQs</Text>
              </Space>
            }
            key="13"
          >
            <Title level={4}>Common Questions & Issues</Title>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={5}>Q: I'm not receiving booking requests. Why?</Title>
                <Paragraph strong>Check these things:</Paragraph>
                <ul>
                  <li>✓ Have you set your Availability? (must have at least some available time slots)</li>
                  <li>✓ Have you selected Services you offer? (customers can only book services you've added)</li>
                  <li>✓ Is your Service Area set correctly? (customers outside your area can't book you)</li>
                  <li>✓ Are your certificates up to date? (expired certificates may block bookings)</li>
                  <li>✓ Do you have Time Off blocking all your available days?</li>
                </ul>
              </div>

              <div>
                <Title level={5}>Q: How do I cancel or reschedule a confirmed booking?</Title>
                <Paragraph>
                  Contact admin immediately. Do not just decline the booking - this may cause issues with customer payment.
                  Admin can help reschedule or properly cancel with customer notification.
                </Paragraph>
              </div>

              <div>
                <Title level={5}>Q: The system calculated fees don't match what I expected. Why?</Title>
                <Paragraph>
                  The system uses:
                </Paragraph>
                <ul>
                  <li>Your hourly rate (set by admin)</li>
                  <li>After-hours rate (if booking is outside 9 AM - 6 PM)</li>
                  <li>Duration of booking</li>
                  <li>Any uplift rates for specific services</li>
                </ul>
                <Paragraph>
                  Check the booking details to see what rate was applied. If you believe there's an error, note it when submitting your invoice.
                </Paragraph>
              </div>

              <div>
                <Title level={5}>Q: Can I edit my availability for just one specific week?</Title>
                <Paragraph>
                  No, Availability sets your recurring weekly schedule. For one-off changes, use Time Off to block specific dates.
                  For example: if you're normally available Mondays but need one Monday off, add that Monday to Time Off.
                </Paragraph>
              </div>

              <div>
                <Title level={5}>Q: What happens if a customer cancels?</Title>
                <Paragraph>
                  The booking status will change to CANCELLED. You won't be paid for cancelled bookings (unless customer is charged a cancellation fee, which admin will notify you about).
                  Cancelled bookings don't appear in your earnings.
                </Paragraph>
              </div>

              <div>
                <Title level={5}>Q: I forgot to mark a booking as complete. What do I do?</Title>
                <Paragraph>
                  Mark it as complete as soon as you remember. Jobs only count towards earnings once marked complete.
                  If the week has already ended and you've submitted your invoice, contact admin to adjust.
                </Paragraph>
              </div>

              <div>
                <Title level={5}>Q: Can I see customer contact details before accepting?</Title>
                <Paragraph>
                  Yes! When you open a REQUESTED booking, you can see:
                </Paragraph>
                <ul>
                  <li>Customer name</li>
                  <li>Contact phone and email</li>
                  <li>Full address</li>
                  <li>Their intake form (health conditions, preferences, etc.)</li>
                </ul>
                <Paragraph>
                  Review all this information before accepting to ensure you're comfortable with the booking.
                </Paragraph>
              </div>

              <div>
                <Title level={5}>Q: How do I add therapist notes to a booking?</Title>
                <Paragraph>
                  Open the booking detail page and scroll to the "Therapist Notes" section at the bottom.
                  Type your notes and click "Save Notes". Use this to record:
                </Paragraph>
                <ul>
                  <li>Customer preferences for future sessions</li>
                  <li>Areas of focus</li>
                  <li>Any issues or concerns</li>
                  <li>Follow-up needed</li>
                </ul>
              </div>

              <div>
                <Title level={5}>Q: What's the difference between PENDING and REQUESTED?</Title>
                <Paragraph>
                  <Tag color="red">PENDING</Tag> - Customer requested a quote, waiting for them to accept the price
                  <br />
                  <Tag color="warning" style={{ backgroundColor: '#FFD700', color: '#000' }}>REQUESTED</Tag> - Customer booked and is waiting for you to accept/decline
                </Paragraph>
                <Paragraph>
                  You don't need to action PENDING bookings - just wait for customer.
                  You MUST respond to REQUESTED bookings.
                </Paragraph>
              </div>

              <div>
                <Title level={5}>Q: Can I provide services outside my service area?</Title>
                <Paragraph>
                  Customers outside your service area cannot book you through the system. If you want to take a booking outside your area:
                </Paragraph>
                <ol>
                  <li>Temporarily expand your service area in the Service Area page</li>
                  <li>Have customer make the booking</li>
                  <li>Adjust service area back after booking is confirmed</li>
                </ol>
                <Paragraph>
                  Or contact admin to manually create the booking.
                </Paragraph>
              </div>

              <div>
                <Title level={5}>Q: I need to change my password. How?</Title>
                <Paragraph>
                  Go to My Profile page and scroll to the bottom. There's a "Change Password" section where you can:
                </Paragraph>
                <ol>
                  <li>Enter your current password</li>
                  <li>Enter new password (min 8 characters, must have uppercase, lowercase, and numbers)</li>
                  <li>Confirm new password</li>
                  <li>Click "Change Password"</li>
                </ol>
              </div>

              <div>
                <Title level={5}>Q: The portal logged me out. Do I need to log in again?</Title>
                <Paragraph>
                  Yes. For security, the portal automatically logs you out after 1 hour of inactivity.
                  You'll see a warning at 55 minutes. Move your mouse or click anything to stay logged in.
                </Paragraph>
              </div>
            </Space>

            <Divider />
            <Title level={4}>Still Need Help?</Title>
            <Paragraph>
              If you can't find the answer here or need further assistance, please contact:
            </Paragraph>
            <ul>
              <li><strong>Email:</strong> [Admin Email]</li>
              <li><strong>Phone:</strong> [Admin Phone]</li>
            </ul>
            <Paragraph>
              We're here to help you succeed!
            </Paragraph>
          </Panel>
        </Collapse>
      </Card>
    </div>
  );
};
