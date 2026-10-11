using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: RuntimeCompatibility(WrapNonExceptionThrows = true)]
[assembly: CompilationRelaxations(8)]
[assembly: AssemblyVersion("0.0.0.0")]
namespace JLeads
{
	public class Lead
	{
		[Browsable(false)]
		public string Id { get; set; }

		public int Score { get; set; }

		[DisplayName("Miles away")]
		public double DistanceMiles { get; set; }

		[DisplayName("Business type")]
		public string BusinessType { get; set; }

		[DisplayName("Business")]
		public string Name { get; set; }

		public string Area { get; set; }

		public string Address { get; set; }

		public string Phone { get; set; }

		public string Website { get; set; }

		[DisplayName("Website status")]
		public string WebsiteStatus { get; set; }

		[DisplayName("Business status")]
		public string BusinessStatus { get; set; }

		[Browsable(false)]
		public string BusinessStatusCode { get; set; }

		[DisplayName("Open now")]
		public string OpenNow { get; set; }

		public double Rating { get; set; }

		[DisplayName("Reviews")]
		public int ReviewCount { get; set; }

		[DisplayName("Latest review")]
		public string LatestReview { get; set; }

		[Browsable(false)]
		public DateTime LatestReviewUtc { get; set; }

		[Browsable(false)]
		public bool HasRecentReview { get; set; }

		[DisplayName("Why prioritised")]
		public string Reason { get; set; }

		[Browsable(false)]
		public string MapsUrl { get; set; }
	}
	public class SearchCentre
	{
		public string Name { get; set; }

		public double Latitude { get; set; }

		public double Longitude { get; set; }

		public SearchCentre(string name, double latitude, double longitude)
		{
			Name = name;
			Latitude = latitude;
			Longitude = longitude;
		}
	}
	public class BusinessTypeDialog : Form
	{
		private readonly CheckedListBox list;

		private static readonly string[] Options = new string[19]
		{
			"Pet groomers", "Roofers", "Tree surgeons", "Plumbers", "Electricians", "Painters and decorators", "Landscapers", "Driveway and patio installers", "Domestic cleaners", "Window cleaners",
			"Mobile car valeters", "Car garages", "Hairdressers and barbers", "Beauty and nail salons", "Locksmiths", "Carpenters and joiners", "Photographers", "Estate agents", "Accountants"
		};

		public List<string> SelectedBusinesses { get; private set; }

		public BusinessTypeDialog(IEnumerable<string> current)
		{
			Text = "Choose business types";
			base.StartPosition = FormStartPosition.CenterParent;
			base.Size = new Size(440, 520);
			MinimumSize = new Size(400, 420);
			BackColor = Color.White;
			Font = new Font("Segoe UI", 9f);
			base.Controls.Add(new Label
			{
				Text = "Choose up to five niches for one campaign",
				Font = new Font("Segoe UI Semibold", 13f),
				AutoSize = true,
				Location = new Point(18, 17)
			});
			base.Controls.Add(new Label
			{
				Text = "Focused lists usually produce better calls than targeting everything.",
				ForeColor = Color.DimGray,
				AutoSize = true,
				Location = new Point(20, 47)
			});
			list = new CheckedListBox
			{
				Location = new Point(20, 78),
				Size = new Size(382, 335),
				Anchor = (AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right),
				CheckOnClick = true,
				BorderStyle = BorderStyle.FixedSingle
			};
			list.Items.AddRange(Options);
			HashSet<string> hashSet = new HashSet<string>(current);
			for (int i = 0; i < list.Items.Count; i++)
			{
				if (hashSet.Contains(Convert.ToString(list.Items[i])))
				{
					list.SetItemChecked(i, true);
				}
			}
			list.ItemCheck += delegate(object s, ItemCheckEventArgs e)
			{
				int num = list.CheckedItems.Count + ((e.NewValue == CheckState.Checked) ? 1 : (-1));
				if (num > 5)
				{
					e.NewValue = CheckState.Unchecked;
					MessageBox.Show("Choose no more than five business types per search.", "Keep the campaign focused", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
				}
			};
			base.Controls.Add(list);
			Button button = new Button
			{
				Text = "Cancel",
				DialogResult = DialogResult.Cancel,
				Size = new Size(90, 34),
				Anchor = (AnchorStyles.Bottom | AnchorStyles.Right),
				Location = new Point(214, 430)
			};
			Button button2 = new Button
			{
				Text = "Use selected",
				Size = new Size(98, 34),
				Anchor = (AnchorStyles.Bottom | AnchorStyles.Right),
				Location = new Point(312, 430),
				BackColor = Color.FromArgb(109, 40, 217),
				ForeColor = Color.White,
				FlatStyle = FlatStyle.Flat
			};
			button2.FlatAppearance.BorderSize = 0;
			button2.Click += delegate
			{
				if (list.CheckedItems.Count == 0)
				{
					MessageBox.Show("Choose at least one business type.");
				}
				else
				{
					SelectedBusinesses = list.CheckedItems.Cast<object>().Select(Convert.ToString).ToList();
					base.DialogResult = DialogResult.OK;
					Close();
				}
			};
			base.Controls.Add(button);
			base.Controls.Add(button2);
			base.AcceptButton = button2;
			base.CancelButton = button;
		}
	}
	public class MainForm : Form
	{
		private const double BookhamLatitude = 51.27922;

		private const double BookhamLongitude = -0.37416;

		private readonly Color Ink = Color.FromArgb(37, 21, 51);

		private readonly Color Purple = Color.FromArgb(109, 40, 217);

		private readonly Color Lavender = Color.FromArgb(247, 243, 255);

		private TextBox apiKey;

		private TrackBar radiusSlider;

		private Label radiusValue;

		private ComboBox dataSource;

		private ComboBox websiteFilter;

		private ComboBox minRating;

		private ComboBox minReviews;

		private ComboBox recentReviewFilter;

		private ComboBox businessStatusFilter;

		private ComboBox outputLimit;

		private Button searchButton;

		private Button exportButton;

		private Button businessPickerButton;

		private Label selectedBusinessLabel;

		private readonly List<string> selectedBusinesses = new List<string> { "Pet groomers" };

		private Label status;

		private Label countLabel;

		private DataGridView grid;

		private List<Lead> allLeads = new List<Lead>();

		[STAThread]
		public static void Main()
		{
			ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
			Application.EnableVisualStyles();
			Application.SetCompatibleTextRenderingDefault(false);
			Application.Run(new MainForm());
		}

		public MainForm()
		{
			Text = "JLEADS — Local Business Lead Finder";
			base.StartPosition = FormStartPosition.CenterScreen;
			MinimumSize = new Size(1050, 690);
			base.Size = new Size(1280, 790);
			base.WindowState = FormWindowState.Maximized;
			BackColor = Lavender;
			Font = new Font("Segoe UI", 9f);
			BuildInterface();
		}

		private void BuildInterface()
		{
			TableLayoutPanel tableLayoutPanel = new TableLayoutPanel();
			tableLayoutPanel.Dock = DockStyle.Fill;
			tableLayoutPanel.RowCount = 2;
			tableLayoutPanel.ColumnCount = 1;
			tableLayoutPanel.Margin = new Padding(0);
			tableLayoutPanel.Padding = new Padding(0);
			TableLayoutPanel tableLayoutPanel2 = tableLayoutPanel;
			tableLayoutPanel2.RowStyles.Add(new RowStyle(SizeType.Absolute, 78f));
			tableLayoutPanel2.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
			tableLayoutPanel2.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
			base.Controls.Add(tableLayoutPanel2);
			Panel panel = new Panel();
			panel.Dock = DockStyle.Fill;
			panel.BackColor = Ink;
			panel.Padding = new Padding(28, 13, 28, 10);
			panel.Margin = new Padding(0);
			Panel panel2 = panel;
			Label label = new Label();
			label.Text = "JLEADS";
			label.ForeColor = Color.White;
			label.Font = new Font("Segoe UI Semibold", 18f);
			label.AutoSize = true;
			label.Location = new Point(25, 13);
			Label value = label;
			Label label2 = new Label();
			label2.Text = "Find businesses that actually need your help";
			label2.ForeColor = Color.FromArgb(220, 201, 255);
			label2.AutoSize = true;
			label2.Location = new Point(28, 46);
			Label value2 = label2;
			panel2.Controls.Add(value);
			panel2.Controls.Add(value2);
			tableLayoutPanel2.Controls.Add(panel2, 0, 0);
			TableLayoutPanel tableLayoutPanel3 = new TableLayoutPanel();
			tableLayoutPanel3.Dock = DockStyle.Fill;
			tableLayoutPanel3.RowCount = 1;
			tableLayoutPanel3.ColumnCount = 2;
			tableLayoutPanel3.Margin = new Padding(0);
			tableLayoutPanel3.Padding = new Padding(0);
			TableLayoutPanel tableLayoutPanel4 = tableLayoutPanel3;
			tableLayoutPanel4.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 355f));
			tableLayoutPanel4.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
			tableLayoutPanel4.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
			tableLayoutPanel2.Controls.Add(tableLayoutPanel4, 0, 1);
			Panel panel3 = new Panel();
			panel3.Dock = DockStyle.Fill;
			panel3.BackColor = Color.FromArgb(250, 248, 255);
			panel3.Padding = new Padding(24);
			panel3.AutoScroll = true;
			panel3.Margin = new Padding(0);
			Panel panel4 = panel3;
			tableLayoutPanel4.Controls.Add(panel4, 0, 0);
			int num = 18;
			AddHeading(panel4, "BUILD YOUR SEARCH", ref num);
			AddLabel(panel4, "DATA SOURCE", ref num);
			dataSource = AddCombo(panel4, ref num, new string[2] { "Free — OpenStreetMap", "Google Places — ratings & reviews" }, 0);
			AddLabel(panel4, "GOOGLE API KEY — ONLY FOR GOOGLE MODE", ref num);
			apiKey = AddTextBox(panel4, ref num, true);
			apiKey.Enabled = false;
			AddLabel(panel4, "BUSINESS TYPES", ref num);
			businessPickerButton = new Button
			{
				Text = "Choose business types  ▾",
				Location = new Point(24, num),
				Size = new Size(295, 34),
				FlatStyle = FlatStyle.Flat,
				BackColor = Color.White,
				ForeColor = Ink,
				TextAlign = ContentAlignment.MiddleLeft,
				Padding = new Padding(8, 0, 0, 0)
			};
			businessPickerButton.FlatAppearance.BorderColor = Color.LightGray;
			businessPickerButton.Click += ChooseBusinesses;
			panel4.Controls.Add(businessPickerButton);
			num += 39;
			selectedBusinessLabel = new Label
			{
				Text = "Pet groomers",
				ForeColor = Purple,
				Font = new Font("Segoe UI", 8f),
				Location = new Point(25, num),
				Size = new Size(292, 31),
				AutoEllipsis = true
			};
			panel4.Controls.Add(selectedBusinessLabel);
			num += 38;
			AddLabel(panel4, "SEARCH CENTRE", ref num);
			Panel panel5 = new Panel();
			panel5.Location = new Point(24, num);
			panel5.Size = new Size(295, 42);
			panel5.BackColor = Color.FromArgb(239, 231, 255);
			Panel panel6 = panel5;
			panel6.Controls.Add(new Label
			{
				Text = "●  Great Bookham, Surrey",
				ForeColor = Purple,
				Font = new Font("Segoe UI Semibold", 9f),
				AutoSize = true,
				Location = new Point(10, 12)
			});
			panel4.Controls.Add(panel6);
			num += 53;
			AddLabel(panel4, "SEARCH RADIUS", ref num);
			radiusSlider = new TrackBar
			{
				Location = new Point(20, num),
				Size = new Size(245, 42),
				Minimum = 1,
				Maximum = 400,
				Value = 15,
				TickFrequency = 50,
				SmallChange = 5,
				LargeChange = 25
			};
			radiusValue = new Label
			{
				Text = "15 mi",
				ForeColor = Purple,
				Font = new Font("Segoe UI Semibold", 10f),
				AutoSize = true,
				Location = new Point(270, num + 8)
			};
			radiusSlider.ValueChanged += delegate
			{
				radiusValue.Text = radiusSlider.Value + " mi";
			};
			panel4.Controls.Add(radiusSlider);
			panel4.Controls.Add(radiusValue);
			num += 52;
			AddLabel(panel4, "WEBSITE QUALITY", ref num);
			websiteFilter = AddCombo(panel4, ref num, new string[4] { "No / poor website", "No website only", "Any website status", "Good website" }, 0);
			AddLabel(panel4, "MINIMUM RATING", ref num);
			minRating = AddCombo(panel4, ref num, new string[4] { "Any", "3.0+", "4.0+", "4.5+" }, 0);
			AddLabel(panel4, "MINIMUM REVIEWS", ref num);
			minReviews = AddCombo(panel4, ref num, new string[4] { "Any", "5+", "10+", "25+" }, 0);
			AddLabel(panel4, "REVIEW ACTIVITY", ref num);
			recentReviewFilter = AddCombo(panel4, ref num, new string[2] { "Review in past 90 days", "Any review date" }, 0);
			recentReviewFilter.Enabled = false;
			AddLabel(panel4, "BUSINESS STATUS", ref num);
			businessStatusFilter = AddCombo(panel4, ref num, new string[4] { "Open businesses only", "Any listing status", "Temporarily closed", "Permanently closed" }, 0);
			businessStatusFilter.Enabled = false;
			AddLabel(panel4, "MAXIMUM RESULTS", ref num);
			outputLimit = AddCombo(panel4, ref num, new string[5] { "50", "100", "250", "500", "1000" }, 1);
			searchButton = new Button
			{
				Text = "Find leads  →",
				Location = new Point(24, num + 4),
				Size = new Size(295, 44),
				FlatStyle = FlatStyle.Flat,
				BackColor = Purple,
				ForeColor = Color.White,
				Font = new Font("Segoe UI Semibold", 10f),
				Cursor = Cursors.Hand
			};
			searchButton.FlatAppearance.BorderSize = 0;
			searchButton.Click += async delegate
			{
				await SearchAsync();
			};
			panel4.Controls.Add(searchButton);
			num += 58;
			Label label3 = new Label();
			label3.Text = "© OpenStreetMap contributors · ODbL. Public business listings only. Manually verify every lead and check TPS/CTPS requirements before calling.";
			label3.ForeColor = Color.Gray;
			label3.Font = new Font("Segoe UI", 8f);
			label3.Location = new Point(24, num);
			label3.Size = new Size(295, 58);
			Label value3 = label3;
			panel4.Controls.Add(value3);
			Panel panel7 = new Panel();
			panel7.Dock = DockStyle.Fill;
			panel7.BackColor = Color.White;
			panel7.Padding = new Padding(28);
			panel7.Margin = new Padding(0);
			Panel panel8 = panel7;
			tableLayoutPanel4.Controls.Add(panel8, 1, 0);
			TableLayoutPanel tableLayoutPanel5 = new TableLayoutPanel();
			tableLayoutPanel5.Dock = DockStyle.Fill;
			tableLayoutPanel5.RowCount = 3;
			tableLayoutPanel5.ColumnCount = 1;
			tableLayoutPanel5.Margin = new Padding(0);
			tableLayoutPanel5.Padding = new Padding(0);
			TableLayoutPanel tableLayoutPanel6 = tableLayoutPanel5;
			tableLayoutPanel6.RowStyles.Add(new RowStyle(SizeType.Absolute, 82f));
			tableLayoutPanel6.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
			tableLayoutPanel6.RowStyles.Add(new RowStyle(SizeType.Absolute, 54f));
			tableLayoutPanel6.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
			panel8.Controls.Add(tableLayoutPanel6);
			Panel resultHeader = new Panel
			{
				Dock = DockStyle.Fill,
				Margin = new Padding(0)
			};
			countLabel = new Label
			{
				Text = "0 leads ready to review",
				ForeColor = Ink,
				Font = new Font("Segoe UI Semibold", 18f),
				AutoSize = true,
				Location = new Point(0, 0)
			};
			status = new Label
			{
				Text = "Run a focused free search. OpenStreetMap coverage varies by area.",
				ForeColor = Color.DimGray,
				AutoSize = true,
				Location = new Point(2, 37)
			};
			exportButton = new Button
			{
				Text = "Export CSV",
				Anchor = (AnchorStyles.Top | AnchorStyles.Right),
				Size = new Size(112, 36),
				Location = new Point(panel8.ClientSize.Width - 112, 5),
				FlatStyle = FlatStyle.Flat,
				BackColor = Color.White,
				ForeColor = Purple,
				Enabled = false
			};
			exportButton.FlatAppearance.BorderColor = Purple;
			exportButton.Click += ExportCsv;
			resultHeader.Controls.Add(countLabel);
			resultHeader.Controls.Add(status);
			resultHeader.Controls.Add(exportButton);
			tableLayoutPanel6.Controls.Add(resultHeader, 0, 0);
			grid = new DataGridView
			{
				Dock = DockStyle.Fill,
				BackgroundColor = Color.White,
				BorderStyle = BorderStyle.None,
				AutoGenerateColumns = true,
				AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None,
				ScrollBars = ScrollBars.Both,
				ReadOnly = true,
				AllowUserToAddRows = false,
				AllowUserToDeleteRows = false,
				AllowUserToResizeRows = false,
				RowHeadersVisible = false,
				SelectionMode = DataGridViewSelectionMode.FullRowSelect,
				MultiSelect = false
			};
			grid.EnableHeadersVisualStyles = false;
			grid.ColumnHeadersDefaultCellStyle.BackColor = Ink;
			grid.ColumnHeadersDefaultCellStyle.ForeColor = Color.White;
			grid.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI Semibold", 9f);
			grid.ColumnHeadersHeight = 38;
			grid.RowTemplate.Height = 42;
			grid.AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(249, 246, 255);
			grid.CellDoubleClick += GridCellDoubleClick;
			tableLayoutPanel6.Controls.Add(grid, 0, 1);
			Panel panel9 = new Panel();
			panel9.Dock = DockStyle.Fill;
			panel9.BackColor = Color.FromArgb(239, 231, 255);
			panel9.Padding = new Padding(13);
			panel9.Margin = new Padding(0);
			Panel panel10 = panel9;
			panel10.Controls.Add(new Label
			{
				Text = "CALL OPENER:  “I found you while researching local businesses. I noticed your online setup may be making enquiries harder to convert — are you taking new customers?”",
				ForeColor = Purple,
				AutoSize = true,
				Location = new Point(12, 18)
			});
			tableLayoutPanel6.Controls.Add(panel10, 0, 2);
			websiteFilter.SelectedIndexChanged += delegate
			{
				ApplyFilters();
			};
			minRating.SelectedIndexChanged += delegate
			{
				ApplyFilters();
			};
			minReviews.SelectedIndexChanged += delegate
			{
				ApplyFilters();
			};
			recentReviewFilter.SelectedIndexChanged += delegate
			{
				ApplyFilters();
			};
			businessStatusFilter.SelectedIndexChanged += delegate
			{
				ApplyFilters();
			};
			outputLimit.SelectedIndexChanged += delegate
			{
				ApplyFilters();
			};
			dataSource.SelectedIndexChanged += delegate
			{
				bool flag = dataSource.SelectedIndex == 1;
				apiKey.Enabled = flag;
				recentReviewFilter.Enabled = flag;
				businessStatusFilter.Enabled = flag;
				status.Text = ((dataSource.SelectedIndex == 0) ? "Free mode selected. Ratings and reviews are unavailable in OpenStreetMap." : "Google mode selected. Recent-review checks use Google's higher-priced reviews field.");
				if (allLeads.Count > 0)
				{
					ApplyFilters();
				}
			};
			resultHeader.Resize += delegate
			{
				exportButton.Left = Math.Max(0, resultHeader.ClientSize.Width - exportButton.Width);
			};
		}

		private void AddHeading(Control parent, string text, ref int y)
		{
			parent.Controls.Add(new Label
			{
				Text = text,
				ForeColor = Purple,
				Font = new Font("Segoe UI Semibold", 11f),
				AutoSize = true,
				Location = new Point(24, y)
			});
			y += 36;
		}

		private void AddLabel(Control parent, string text, ref int y)
		{
			parent.Controls.Add(new Label
			{
				Text = text,
				ForeColor = Color.FromArgb(68, 51, 82),
				Font = new Font("Segoe UI Semibold", 8f),
				AutoSize = true,
				Location = new Point(24, y)
			});
			y += 19;
		}

		private TextBox AddTextBox(Control parent, ref int y, bool password)
		{
			TextBox textBox = new TextBox();
			textBox.Location = new Point(24, y);
			textBox.Size = new Size(295, 27);
			textBox.BorderStyle = BorderStyle.FixedSingle;
			textBox.UseSystemPasswordChar = password;
			TextBox textBox2 = textBox;
			parent.Controls.Add(textBox2);
			y += 39;
			return textBox2;
		}

		private ComboBox AddCombo(Control parent, ref int y, string[] items, int selected)
		{
			ComboBox comboBox = new ComboBox();
			comboBox.Location = new Point(24, y);
			comboBox.Size = new Size(295, 30);
			comboBox.DropDownStyle = ComboBoxStyle.DropDownList;
			ComboBox comboBox2 = comboBox;
			comboBox2.Items.AddRange(items);
			comboBox2.SelectedIndex = selected;
			parent.Controls.Add(comboBox2);
			y += 42;
			return comboBox2;
		}

		private void ChooseBusinesses(object sender, EventArgs e)
		{
			using (BusinessTypeDialog businessTypeDialog = new BusinessTypeDialog(selectedBusinesses))
			{
				if (businessTypeDialog.ShowDialog(this) == DialogResult.OK)
				{
					selectedBusinesses.Clear();
					selectedBusinesses.AddRange(businessTypeDialog.SelectedBusinesses);
					selectedBusinessLabel.Text = string.Join(", ", selectedBusinesses);
				}
			}
		}

		private async Task SearchAsync()
		{
			if (selectedBusinesses.Count == 0)
			{
				MessageBox.Show("Choose at least one business type.", "Search details required", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
				return;
			}
			int radiusMiles = radiusSlider.Value;
			bool useGoogle = dataSource.SelectedIndex == 1;
			if (useGoogle && apiKey.Text.Trim().Length == 0)
			{
				MessageBox.Show("Enter your Google Places API key, or choose Free — OpenStreetMap.", "API key required", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
				return;
			}
			if (!useGoogle && radiusMiles > 30)
			{
				MessageBox.Show("Free OpenStreetMap mode is limited to 30 miles to protect the community service. Choose Google Places for larger searches.", "Google mode required", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
				return;
			}
			searchButton.Enabled = false;
			searchButton.Text = "Searching…";
			status.Text = "Searching within " + radiusMiles + " miles of Bookham…";
			allLeads.Clear();
			try
			{
				Dictionary<string, Lead> collected = new Dictionary<string, Lead>();
				int failedAreas = 0;
				List<string> failedNames = new List<string>();
				int maximum = int.Parse(Convert.ToString(outputLimit.SelectedItem));
				int job = 0;
				int businessIndex = 0;
				List<SearchCentre> centres = (useGoogle ? GetSearchCentres(radiusMiles) : new List<SearchCentre>
				{
					new SearchCentre("Bookham", 51.27922, -0.37416)
				});
				int totalJobs = selectedBusinesses.Count * centres.Count;
				foreach (string niche in selectedBusinesses)
				{
					int targetForType = maximum / selectedBusinesses.Count + ((businessIndex < maximum % selectedBusinesses.Count) ? 1 : 0);
					int collectedForType = 0;
					businessIndex++;
					string[] selectors = null;
					if (!useGoogle)
					{
						try
						{
							selectors = GetOsmSelectors(niche);
						}
						catch (Exception ex)
						{
							failedAreas++;
							failedNames.Add(niche + " (" + ShortError(ex.Message) + ")");
							continue;
						}
					}
					foreach (SearchCentre centre in centres)
					{
						if (collectedForType >= targetForType)
						{
							break;
						}
						job++;
						status.Text = "Searching " + niche + " near " + centre.Name + " (" + job + " of up to " + totalJobs + ")…";
						try
						{
							int remaining = targetForType - collectedForType;
							List<Lead> list = (useGoogle ? (await SearchGoogleAreaAsync(apiKey.Text.Trim(), niche, centre, radiusMiles, remaining)) : (await SearchAreaAsync(selectors, radiusMiles)));
							List<Lead> batch = list;
							foreach (Lead item in batch)
							{
								if (!collected.ContainsKey(item.Id))
								{
									item.BusinessType = niche;
									collected.Add(item.Id, item);
								if (MatchesCurrentFilters(item))
								{
									collectedForType++;
								}
									if (collectedForType >= targetForType)
									{
										break;
									}
								}
							}
						}
						catch (TaskCanceledException)
						{
							failedAreas++;
							failedNames.Add(niche + " — " + centre.Name + " (timed out)");
						}
						catch (Exception ex3)
						{
							failedAreas++;
							failedNames.Add(niche + " — " + centre.Name + " (" + ShortError(ex3.Message) + ")");
						}
					}
				}
				allLeads = (from x in collected.Values
					where x.DistanceMiles <= (double)radiusMiles
					orderby x.DistanceMiles, x.Score descending, x.ReviewCount descending, x.Name
					select x).ToList();
				ApplyFilters();
				if (failedAreas > 0)
				{
					MessageBox.Show("Some business searches were skipped, but successful results are shown.\r\n\r\n" + string.Join("\r\n", failedNames), "Partial search completed", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
				}
				if (allLeads.Count == 0 && failedAreas == 0)
				{
					MessageBox.Show("No matching listings were found inside the selected Bookham radius. Increase the mileage, loosen the filters, or choose another business type.", "No matching listings", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
				}
			}
			catch (Exception ex4)
			{
				status.Text = "Search failed.";
				MessageBox.Show(FriendlyError(ex4), "Search could not be completed", MessageBoxButtons.OK, MessageBoxIcon.Hand);
			}
			finally
			{
				searchButton.Enabled = true;
				searchButton.Text = "Find leads  →";
			}
		}

		private async Task<List<Lead>> SearchAreaAsync(string[] selectors, int radiusMiles)
		{
			using (HttpClient client = new HttpClient())
			{
				client.Timeout = TimeSpan.FromSeconds(100.0);
				client.DefaultRequestHeaders.UserAgent.ParseAdd("JLEADSDesktop/1.0");
				JavaScriptSerializer serializer = new JavaScriptSerializer();
				StringBuilder query = new StringBuilder("[out:json][timeout:30];(");
				int radiusMetres = (int)Math.Round((double)radiusMiles * 1609.344);
				foreach (string value in selectors)
				{
					query.Append("nwr").Append(value).Append("(around:")
						.Append(radiusMetres)
						.Append(",")
						.Append(51.27922.ToString(CultureInfo.InvariantCulture))
						.Append(",")
						.Append((-0.37416).ToString(CultureInfo.InvariantCulture))
						.Append(");");
				}
				query.Append(");out center tags;");
				new FormUrlEncodedContent(new KeyValuePair<string, string>[1]
				{
					new KeyValuePair<string, string>("data", query.ToString())
				});
				string responseText = null;
				int lastStatus = 0;
				string[] overpassServers = new string[2] { "https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter" };
				int num = default(int);
				string[] array = default(string[]);
				int num2 = default(int);
				string server = default(string);
				switch (num)
				{
				default:
					array = overpassServers;
					num2 = 0;
					goto IL_0430;
				case 0:
				case 1:
				case 2:
					{
						try
						{
							HttpResponseMessage response = await client.PostAsync(server, new FormUrlEncodedContent(new KeyValuePair<string, string>[1]
							{
								new KeyValuePair<string, string>("data", query.ToString())
							}));
							lastStatus = (int)response.StatusCode;
							if (response.IsSuccessStatusCode)
							{
								responseText = await response.Content.ReadAsStringAsync();
								break;
							}
							if (response.StatusCode == (HttpStatusCode)429 || response.StatusCode >= HttpStatusCode.InternalServerError)
							{
								await Task.Delay(3000);
							}
							goto IL_0422;
						}
						catch (TaskCanceledException)
						{
							lastStatus = 408;
							goto IL_0422;
						}
					}
					IL_0430:
					if (num2 >= array.Length)
					{
						break;
					}
					server = array[num2];
					goto case 0;
					IL_0422:
					num2++;
					goto IL_0430;
				}
				if (responseText == null)
				{
					throw new Exception("The free OpenStreetMap search services are busy (" + lastStatus + "). Wait two minutes, then search one or two locations at a time.");
				}
				Dictionary<string, object> root = serializer.DeserializeObject(responseText) as Dictionary<string, object>;
				List<Lead> list = new List<Lead>();
				object rawElements;
				if (root != null && root.TryGetValue("elements", out rawElements))
				{
					object[] array2 = (object[])rawElements;
					foreach (object obj in array2)
					{
						Dictionary<string, object> dictionary = obj as Dictionary<string, object>;
						if (dictionary == null)
						{
							continue;
						}
						Dictionary<string, object> dictionary2 = GetDictionary(dictionary, "tags");
						string text = First(dictionary2, "name", "operator");
						if (text.Length != 0)
						{
							string text2 = First(dictionary2, "website", "contact:website", "url");
							string websiteStatus = AssessWebsite(text2);
							string text3 = First(dictionary2, "phone", "contact:phone", "mobile", "contact:mobile");
							string text4 = BuildAddress(dictionary2, "Bookham area");
							bool flag = Regex.IsMatch(text, "\\b(ltd|limited|llp)\\b", RegexOptions.IgnoreCase);
							int num3 = ((text2.Length == 0) ? 55 : (IsWeakWebsiteStatus(websiteStatus) ? 45 : 15));
							List<string> list2 = new List<string>();
							list2.Add(websiteStatus);
							List<string> list3 = list2;
							if (text3.Length > 0)
							{
								num3 += 25;
								list3.Add("phone available");
							}
							if (text4 != "Bookham area")
							{
								num3 += 10;
								list3.Add("address details");
							}
							if (flag)
							{
								num3 += 10;
								list3.Add("corporate-name signal");
							}
							double @double = GetDouble(dictionary, "lat");
							double double2 = GetDouble(dictionary, "lon");
							Dictionary<string, object> dictionary3 = GetDictionary(dictionary, "center");
							if (@double == 0.0 && dictionary3 != null)
							{
								@double = GetDouble(dictionary3, "lat");
								double2 = GetDouble(dictionary3, "lon");
							}
							string mapsUrl = ((@double == 0.0) ? "https://www.openstreetmap.org/" : ("https://www.openstreetmap.org/?mlat=" + @double.ToString(CultureInfo.InvariantCulture) + "&mlon=" + double2.ToString(CultureInfo.InvariantCulture) + "#map=18/" + @double.ToString(CultureInfo.InvariantCulture) + "/" + double2.ToString(CultureInfo.InvariantCulture)));
							double num4 = DistanceInMiles(51.27922, -0.37416, @double, double2);
							if (num4 <= (double)radiusMiles)
							{
								list.Add(new Lead
								{
									Id = GetString(dictionary, "type") + "/" + GetString(dictionary, "id"),
									Score = Math.Min(num3, 100),
									DistanceMiles = Math.Round(num4, 1),
									Name = text,
									Area = "Bookham radius",
									Address = text4,
									Phone = text3,
									Website = text2,
									WebsiteStatus = websiteStatus,
									BusinessStatus = "Unknown in free mode",
									BusinessStatusCode = "UNKNOWN",
									OpenNow = "Unknown",
									Rating = 0.0,
									ReviewCount = 0,
									LatestReview = "Unavailable in free mode",
									LatestReviewUtc = DateTime.MinValue,
									HasRecentReview = false,
									Reason = string.Join(" · ", list3),
									MapsUrl = mapsUrl
								});
							}
						}
					}
				}
				return list;
			}
		}

		private async Task<List<Lead>> SearchGoogleAreaAsync(string key, string niche, SearchCentre searchCentre, int radiusMiles, int remaining)
		{
			using (HttpClient client = new HttpClient())
			{
				client.Timeout = TimeSpan.FromSeconds(40.0);
				client.DefaultRequestHeaders.Add("X-Goog-Api-Key", key);
				client.DefaultRequestHeaders.Add("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.location,places.rating,places.userRatingCount,places.reviews,places.businessStatus,places.currentOpeningHours,nextPageToken");
				JavaScriptSerializer serializer = new JavaScriptSerializer();
				List<Lead> list = new List<Lead>();
				string pageToken = null;
				int maxPages = Math.Min(3, Math.Max(1, (int)Math.Ceiling((double)remaining / 20.0)));
				for (int page = 0; page < maxPages; page++)
				{
					double radiusMetres = Math.Min(50000.0, Math.Max(5000.0, (double)radiusMiles * 1609.344));
					Dictionary<string, object> centre = new Dictionary<string, object>
					{
						{ "latitude", searchCentre.Latitude },
						{ "longitude", searchCentre.Longitude }
					};
					Dictionary<string, object> circle = new Dictionary<string, object>
					{
						{ "center", centre },
						{ "radius", radiusMetres }
					};
					Dictionary<string, object> requestBody = new Dictionary<string, object>
					{
						{
							"textQuery",
							niche + " near " + searchCentre.Name + ", United Kingdom"
						},
						{ "languageCode", "en" },
						{ "regionCode", "GB" },
						{ "pageSize", 20 },
						{ "includePureServiceAreaBusinesses", true },
						{
							"locationBias",
							new Dictionary<string, object> { { "circle", circle } }
						}
					};
					if (!string.IsNullOrWhiteSpace(pageToken))
					{
						requestBody.Add("pageToken", pageToken);
					}
					HttpResponseMessage response = await client.PostAsync("https://places.googleapis.com/v1/places:searchText", new StringContent(serializer.Serialize(requestBody), Encoding.UTF8, "application/json"));
					string responseText = await response.Content.ReadAsStringAsync();
					if (!response.IsSuccessStatusCode)
					{
						throw new Exception("Google Places returned " + (int)response.StatusCode + ". " + ExtractApiMessage(responseText));
					}
					Dictionary<string, object> root = serializer.DeserializeObject(responseText) as Dictionary<string, object>;
					object rawPlaces;
					if (root != null && root.TryGetValue("places", out rawPlaces))
					{
						object[] array = (object[])rawPlaces;
						foreach (object obj in array)
						{
							Dictionary<string, object> dictionary = obj as Dictionary<string, object>;
							if (dictionary == null)
							{
								continue;
							}
							string @string = GetString(dictionary, "businessStatus");
							string businessStatus = FriendlyBusinessStatus(@string);
							string openNow = GetOpenNowStatus(GetDictionary(dictionary, "currentOpeningHours"));
							Dictionary<string, object> dictionary2 = GetDictionary(dictionary, "displayName");
							string string2 = GetString(dictionary2, "text");
							string string3 = GetString(dictionary, "websiteUri");
							string websiteStatus = AssessWebsite(string3);
							string string4 = GetString(dictionary, "nationalPhoneNumber");
							double @double = GetDouble(dictionary, "rating");
							int @int = GetInt(dictionary, "userRatingCount");
							DateTime latestReviewUtc = GetLatestReviewUtc(dictionary);
							bool hasRecentReview = latestReviewUtc != DateTime.MinValue && latestReviewUtc >= DateTime.UtcNow.AddDays(-90.0);
							bool flag = Regex.IsMatch(string2, "\\b(ltd|limited|llp)\\b", RegexOptions.IgnoreCase);
							Dictionary<string, object> dictionary3 = GetDictionary(dictionary, "location");
							double double2 = GetDouble(dictionary3, "latitude");
							double double3 = GetDouble(dictionary3, "longitude");
							double num = DistanceInMiles(51.27922, -0.37416, double2, double3);
							if (double2 != 0.0 && !(num > (double)radiusMiles))
							{
								int num2 = ((string3.Length == 0) ? 55 : (IsWeakWebsiteStatus(websiteStatus) ? 45 : 15));
								List<string> list2 = new List<string>();
								list2.Add(websiteStatus);
								List<string> list3 = list2;
								if (string4.Length > 0)
								{
									num2 += 10;
									list3.Add("phone available");
								}
								if (@int >= 20)
								{
									num2 += 15;
									list3.Add("established demand");
								}
								else if (@int >= 5)
								{
									num2 += 8;
									list3.Add("some proven demand");
								}
								if (@double >= 4.3)
								{
									num2 += 10;
									list3.Add("strong reputation");
								}
								if (hasRecentReview)
								{
									num2 += 15;
									list3.Add("review in past 90 days");
								}
								if (flag)
								{
									num2 += 10;
									list3.Add("corporate-name signal");
								}
								list.Add(new Lead
								{
									Id = GetString(dictionary, "id"),
									Score = Math.Min(num2, 100),
									DistanceMiles = Math.Round(num, 1),
									Name = string2,
									Area = "Bookham radius",
									Address = GetString(dictionary, "formattedAddress"),
									Phone = string4,
									Website = string3,
									WebsiteStatus = websiteStatus,
									BusinessStatus = businessStatus,
									BusinessStatusCode = @string,
									OpenNow = openNow,
									Rating = @double,
									ReviewCount = @int,
									LatestReview = ((latestReviewUtc == DateTime.MinValue) ? "Not returned" : latestReviewUtc.ToString("dd MMM yyyy", CultureInfo.InvariantCulture)),
									LatestReviewUtc = latestReviewUtc,
									HasRecentReview = hasRecentReview,
									Reason = string.Join(" · ", list3),
									MapsUrl = GetString(dictionary, "googleMapsUri")
								});
							}
						}
					}
					if (root == null)
					{
						break;
					}
					pageToken = GetString(root, "nextPageToken");
					if (string.IsNullOrWhiteSpace(pageToken))
					{
						break;
					}
				}
				return list;
			}
		}

		private void ApplyFilters()
		{
			int count = ((outputLimit != null && outputLimit.SelectedItem != null) ? int.Parse(Convert.ToString(outputLimit.SelectedItem)) : 100);
			List<Lead> list = (from x in allLeads
				where MatchesCurrentFilters(x)
				orderby x.DistanceMiles, x.Score descending
				select x).Take(count).ToList();
			string text = string.Join(" · ", from x in list
				group x by x.BusinessType into g
				select g.Key + ": " + g.Count());
			grid.DataSource = new BindingList<Lead>(list);
			countLabel.Text = list.Count + " leads across " + list.Select((Lead x) => x.BusinessType).Distinct().Count() + " business type(s)";
			status.Text = allLeads.Count + " found inside radius · " + list.Count + " match filters · " + text;
			exportButton.Enabled = list.Count > 0;
			if (grid.Columns.Count > 0)
			{
				grid.Columns["Score"].Width = 55;
				grid.Columns["DistanceMiles"].Width = 75;
				grid.Columns["BusinessType"].Width = 155;
				grid.Columns["Name"].Width = 190;
				grid.Columns["Area"].Width = 100;
				grid.Columns["Address"].Width = 260;
				grid.Columns["Phone"].Width = 120;
				grid.Columns["Website"].Width = 220;
				grid.Columns["WebsiteStatus"].Width = 170;
				grid.Columns["BusinessStatus"].Width = 125;
				grid.Columns["OpenNow"].Width = 75;
				grid.Columns["Rating"].Width = 65;
				grid.Columns["ReviewCount"].Width = 70;
				grid.Columns["LatestReview"].Width = 105;
				grid.Columns["Reason"].Width = 260;
			}
		}

		private bool MatchesCurrentFilters(Lead lead)
		{
			bool hasWebsite = !string.IsNullOrWhiteSpace(lead.Website);
			bool weakWebsite = IsWeakWebsiteStatus(lead.WebsiteStatus);
			switch (websiteFilter.SelectedIndex)
			{
			case 0:
				if (hasWebsite && !weakWebsite) return false;
				break;
			case 1:
				if (hasWebsite) return false;
				break;
			case 3:
				if (!hasWebsite || weakWebsite) return false;
				break;
			}

			double rating = (new double[4] { 0.0, 3.0, 4.0, 4.5 })[minRating.SelectedIndex];
			int reviews = (new int[4] { 0, 5, 10, 25 })[minReviews.SelectedIndex];
			if (lead.Rating < rating || lead.ReviewCount < reviews) return false;
			if (dataSource.SelectedIndex == 1 && recentReviewFilter.SelectedIndex == 0 && !lead.HasRecentReview) return false;
			if (dataSource.SelectedIndex == 1)
			{
				switch (businessStatusFilter.SelectedIndex)
				{
				case 0:
					if (lead.BusinessStatusCode != "OPERATIONAL") return false;
					break;
				case 2:
					if (lead.BusinessStatusCode != "CLOSED_TEMPORARILY") return false;
					break;
				case 3:
					if (lead.BusinessStatusCode != "CLOSED_PERMANENTLY") return false;
					break;
				}
			}
			return true;
		}

		private static string AssessWebsite(string website)
		{
			if (string.IsNullOrWhiteSpace(website)) return "Missing";
			Uri uri;
			string candidate = website.Trim();
			if (!Uri.TryCreate(candidate, UriKind.Absolute, out uri) && !Uri.TryCreate("https://" + candidate, UriKind.Absolute, out uri))
			{
				return "Weak - invalid URL";
			}

			string host = uri.Host.ToLowerInvariant();
			string[] thirdPartyHosts = new string[]
			{
				"facebook.com", "instagram.com", "linktr.ee", "yell.com", "yelp.com", "freeindex.co.uk",
				"google.com", "business.site", "sites.google.com", "fresha.com", "booksy.com", "treatwell.co.uk"
			};
			if (thirdPartyHosts.Any(delegate(string domain) { return host == domain || host.EndsWith("." + domain, StringComparison.Ordinal); }))
			{
				return "Weak - third-party profile";
			}

			string[] freeSiteHosts = new string[] { "wixsite.com", "weebly.com", "wordpress.com", "webs.com" };
			if (freeSiteHosts.Any(delegate(string domain) { return host == domain || host.EndsWith("." + domain, StringComparison.Ordinal); }))
			{
				return "Weak - free-site address";
			}
			if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
			{
				return "Weak - no HTTPS";
			}
			return "Website listed";
		}

		private static bool IsWeakWebsiteStatus(string statusText)
		{
			return !string.IsNullOrWhiteSpace(statusText) && statusText.StartsWith("Weak", StringComparison.OrdinalIgnoreCase);
		}

		private static string FriendlyBusinessStatus(string statusCode)
		{
			switch (statusCode)
			{
			case "OPERATIONAL":
				return "Open";
			case "CLOSED_TEMPORARILY":
				return "Temporarily closed";
			case "CLOSED_PERMANENTLY":
				return "Permanently closed";
			default:
				return "Unknown";
			}
		}

		private static string GetOpenNowStatus(Dictionary<string, object> openingHours)
		{
			object rawOpenNow;
			if (openingHours != null && openingHours.TryGetValue("openNow", out rawOpenNow) && rawOpenNow is bool)
			{
				return ((bool)rawOpenNow) ? "Yes" : "No";
			}
			return "Unknown";
		}

		private static DateTime GetLatestReviewUtc(Dictionary<string, object> place)
		{
			object rawReviews;
			if (place == null || !place.TryGetValue("reviews", out rawReviews)) return DateTime.MinValue;
			object[] reviews = rawReviews as object[];
			if (reviews == null) return DateTime.MinValue;
			DateTime latest = DateTime.MinValue;
			foreach (object rawReview in reviews)
			{
				Dictionary<string, object> review = rawReview as Dictionary<string, object>;
				DateTimeOffset published;
				if (review != null && DateTimeOffset.TryParse(GetString(review, "publishTime"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out published) && published.UtcDateTime > latest)
				{
					latest = published.UtcDateTime;
				}
			}
			return latest;
		}

		private void ExportCsv(object sender, EventArgs e)
		{
			BindingList<Lead> bindingList = grid.DataSource as BindingList<Lead>;
			if (bindingList == null || bindingList.Count == 0)
			{
				return;
			}
			SaveFileDialog saveFileDialog = new SaveFileDialog();
			saveFileDialog.Filter = "CSV file (*.csv)|*.csv";
			saveFileDialog.FileName = SafeName(selectedBusinesses.FirstOrDefault() ?? "local-business") + "-leads.csv";
			using (SaveFileDialog saveFileDialog2 = saveFileDialog)
			{
				if (saveFileDialog2.ShowDialog() != DialogResult.OK)
				{
					return;
				}
				StringBuilder stringBuilder = new StringBuilder();
				stringBuilder.AppendLine("lead_score,miles_from_bookham,business_type,business_name,area,address,phone,website,website_status,business_status,open_now,rating,review_count,latest_review,review_in_past_90_days,why_prioritised,google_maps_url");
				foreach (Lead item in bindingList)
				{
					stringBuilder.AppendLine(string.Join(",", Csv(item.Score), Csv(item.DistanceMiles), Csv(item.BusinessType), Csv(item.Name), Csv(item.Area), Csv(item.Address), Csv(item.Phone), Csv(item.Website), Csv(item.WebsiteStatus), Csv(item.BusinessStatus), Csv(item.OpenNow), Csv(item.Rating), Csv(item.ReviewCount), Csv(item.LatestReview), Csv(item.HasRecentReview ? "Yes" : "No"), Csv(item.Reason), Csv(item.MapsUrl)));
				}
				File.WriteAllText(saveFileDialog2.FileName, stringBuilder.ToString(), new UTF8Encoding(true));
				MessageBox.Show("Saved " + bindingList.Count + " leads.", "Export complete", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
			}
		}

		private void GridCellDoubleClick(object sender, DataGridViewCellEventArgs e)
		{
			if (e.RowIndex < 0)
			{
				return;
			}
			Lead lead = grid.Rows[e.RowIndex].DataBoundItem as Lead;
			if (lead == null || string.IsNullOrWhiteSpace(lead.MapsUrl))
			{
				return;
			}
			try
			{
				Process.Start(lead.MapsUrl);
			}
			catch
			{
			}
		}

		private static string FriendlyError(Exception ex)
		{
			if (ex.Message.Contains("403"))
			{
				return "Google rejected the request. Check that Places API (New) and billing are enabled.\r\n\r\n" + ex.Message;
			}
			return ex.Message;
		}

		private static double DistanceInMiles(double latitude1, double longitude1, double latitude2, double longitude2)
		{
			double d = latitude1 * Math.PI / 180.0;
			double d2 = latitude2 * Math.PI / 180.0;
			double num = (latitude2 - latitude1) * Math.PI / 180.0;
			double num2 = (longitude2 - longitude1) * Math.PI / 180.0;
			double num3 = Math.Sin(num / 2.0) * Math.Sin(num / 2.0) + Math.Cos(d) * Math.Cos(d2) * Math.Sin(num2 / 2.0) * Math.Sin(num2 / 2.0);
			return 7917.5226 * Math.Atan2(Math.Sqrt(num3), Math.Sqrt(1.0 - num3));
		}

		private static List<SearchCentre> GetSearchCentres(int radiusMiles)
		{
			List<SearchCentre> list = new List<SearchCentre>();
			list.Add(new SearchCentre("Bookham", 51.27922, -0.37416));
			list.Add(new SearchCentre("London", 51.5074, -0.1278));
			list.Add(new SearchCentre("Brighton", 50.8225, -0.1372));
			list.Add(new SearchCentre("Reading", 51.4543, -0.9781));
			list.Add(new SearchCentre("Oxford", 51.752, -1.2577));
			list.Add(new SearchCentre("Southampton", 50.9097, -1.4044));
			list.Add(new SearchCentre("Portsmouth", 50.8198, -1.088));
			list.Add(new SearchCentre("Maidstone", 51.2704, 0.5227));
			list.Add(new SearchCentre("Canterbury", 51.2802, 1.0789));
			list.Add(new SearchCentre("Cambridge", 52.2053, 0.1218));
			list.Add(new SearchCentre("Milton Keynes", 52.0406, -0.7594));
			list.Add(new SearchCentre("Swindon", 51.5558, -1.7797));
			list.Add(new SearchCentre("Bournemouth", 50.7192, -1.8808));
			list.Add(new SearchCentre("Bristol", 51.4545, -2.5879));
			list.Add(new SearchCentre("Bath", 51.3811, -2.359));
			list.Add(new SearchCentre("Cardiff", 51.4816, -3.1791));
			list.Add(new SearchCentre("Exeter", 50.7184, -3.5339));
			list.Add(new SearchCentre("Plymouth", 50.3755, -4.1427));
			list.Add(new SearchCentre("Birmingham", 52.4862, -1.8904));
			list.Add(new SearchCentre("Coventry", 52.4068, -1.5197));
			list.Add(new SearchCentre("Northampton", 52.2405, -0.9027));
			list.Add(new SearchCentre("Leicester", 52.6369, -1.1398));
			list.Add(new SearchCentre("Nottingham", 52.9548, -1.1581));
			list.Add(new SearchCentre("Derby", 52.9225, -1.4746));
			list.Add(new SearchCentre("Peterborough", 52.5695, -0.2405));
			list.Add(new SearchCentre("Norwich", 52.6309, 1.2974));
			list.Add(new SearchCentre("Ipswich", 52.0567, 1.1482));
			list.Add(new SearchCentre("Lincoln", 53.2307, -0.5406));
			list.Add(new SearchCentre("Sheffield", 53.3811, -1.4701));
			list.Add(new SearchCentre("Manchester", 53.4808, -2.2426));
			list.Add(new SearchCentre("Liverpool", 53.4084, -2.9916));
			list.Add(new SearchCentre("Stoke-on-Trent", 53.0027, -2.1794));
			list.Add(new SearchCentre("Chester", 53.1934, -2.8931));
			list.Add(new SearchCentre("Leeds", 53.8008, -1.5491));
			list.Add(new SearchCentre("York", 53.959, -1.0815));
			list.Add(new SearchCentre("Hull", 53.7676, -0.3274));
			list.Add(new SearchCentre("Swansea", 51.6214, -3.9436));
			list.Add(new SearchCentre("Aberystwyth", 52.4153, -4.0829));
			list.Add(new SearchCentre("Newcastle", 54.9783, -1.6178));
			list.Add(new SearchCentre("Middlesbrough", 54.5742, -1.235));
			list.Add(new SearchCentre("Carlisle", 54.8925, -2.9329));
			list.Add(new SearchCentre("Lancaster", 54.047, -2.801));
			list.Add(new SearchCentre("Edinburgh", 55.9533, -3.1883));
			list.Add(new SearchCentre("Glasgow", 55.8642, -4.2518));
			list.Add(new SearchCentre("Dumfries", 55.0709, -3.6051));
			list.Add(new SearchCentre("Dundee", 56.462, -2.9707));
			List<SearchCentre> source = list;
			if (radiusMiles <= 30)
			{
				return source.Take(1).ToList();
			}
			return (from c in source
				where DistanceInMiles(51.27922, -0.37416, c.Latitude, c.Longitude) <= (double)(radiusMiles + 28)
				orderby DistanceInMiles(51.27922, -0.37416, c.Latitude, c.Longitude)
				select c).ToList();
		}

		private static string ShortError(string message)
		{
			if (string.IsNullOrWhiteSpace(message))
			{
				return "failed";
			}
			string text = message.Split(new char[2] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
			string obj;
			if (text == null || text.Length <= 70)
			{
				obj = text;
				if (obj == null)
				{
					return "failed";
				}
			}
			else
			{
				obj = text.Substring(0, 70) + "…";
			}
			return obj;
		}

		private static string ExtractApiMessage(string json)
		{
			try
			{
				Dictionary<string, object> d = new JavaScriptSerializer().DeserializeObject(json) as Dictionary<string, object>;
				return GetString(GetDictionary(d, "error"), "message");
			}
			catch
			{
				return "";
			}
		}

		private static async Task<string> GetWithRetry(HttpClient client, string url, int retries)
		{
			for (int i = 0; i <= retries; i++)
			{
				HttpResponseMessage response = await client.GetAsync(url);
				if (response.IsSuccessStatusCode)
				{
					return await response.Content.ReadAsStringAsync();
				}
				if (response.StatusCode != (HttpStatusCode)429 || i == retries)
				{
					throw new Exception("OpenStreetMap location search returned " + (int)response.StatusCode + ". Wait two minutes and try fewer locations.");
				}
				await Task.Delay(2500 * (i + 1));
			}
			throw new Exception("Location search failed.");
		}

		private static string[] GetOsmSelectors(string businessType)
		{
			string text = businessType.ToLowerInvariant().Trim();
			if (text.Contains("groom"))
			{
				return new string[3] { "[\"shop\"=\"pet_grooming\"]", "[\"shop\"=\"dog_grooming\"]", "[\"amenity\"=\"dog_grooming\"]" };
			}
			if (text.Contains("roof"))
			{
				return new string[1] { "[\"craft\"=\"roofer\"]" };
			}
			if (text.Contains("tree") || text.Contains("arbor"))
			{
				return new string[1] { "[\"craft\"=\"arborist\"]" };
			}
			if (text.Contains("plumb"))
			{
				return new string[1] { "[\"craft\"=\"plumber\"]" };
			}
			if (text.Contains("electric"))
			{
				return new string[1] { "[\"craft\"=\"electrician\"]" };
			}
			if (text.Contains("paint") || text.Contains("decorat"))
			{
				return new string[1] { "[\"craft\"=\"painter\"]" };
			}
			if (text.Contains("carpent") || text.Contains("joiner"))
			{
				return new string[1] { "[\"craft\"=\"carpenter\"]" };
			}
			if (text.Contains("locksmith"))
			{
				return new string[1] { "[\"craft\"=\"locksmith\"]" };
			}
			if (text.Contains("hair"))
			{
				return new string[1] { "[\"shop\"=\"hairdresser\"]" };
			}
			if (text.Contains("beauty") || text.Contains("nail"))
			{
				return new string[1] { "[\"shop\"=\"beauty\"]" };
			}
			if (text.Contains("dent"))
			{
				return new string[1] { "[\"amenity\"=\"dentist\"]" };
			}
			if (text.Contains("vet"))
			{
				return new string[1] { "[\"amenity\"=\"veterinary\"]" };
			}
			if (text.Contains("restaurant"))
			{
				return new string[1] { "[\"amenity\"=\"restaurant\"]" };
			}
			if (text.Contains("cafe") || text.Contains("coffee"))
			{
				return new string[1] { "[\"amenity\"=\"cafe\"]" };
			}
			if (text.Contains("gym") || text.Contains("fitness"))
			{
				return new string[1] { "[\"leisure\"=\"fitness_centre\"]" };
			}
			if (text.Contains("estate") || text.Contains("letting"))
			{
				return new string[1] { "[\"office\"=\"estate_agent\"]" };
			}
			if (text.Contains("account"))
			{
				return new string[1] { "[\"office\"=\"accountant\"]" };
			}
			if (text.Contains("solicitor") || text.Contains("lawyer"))
			{
				return new string[1] { "[\"office\"=\"lawyer\"]" };
			}
			if (text.Contains("garage") || text.Contains("car repair") || text.Contains("mechanic"))
			{
				return new string[1] { "[\"shop\"=\"car_repair\"]" };
			}
			if (text.Contains("florist") || text.Contains("flower"))
			{
				return new string[1] { "[\"shop\"=\"florist\"]" };
			}
			if (text.Contains("bakery") || text.Contains("baker"))
			{
				return new string[1] { "[\"shop\"=\"bakery\"]" };
			}
			if (text.Contains("photograph"))
			{
				return new string[1] { "[\"craft\"=\"photographer\"]" };
			}
			throw new Exception("Free search currently supports pet groomers, roofers, tree surgeons, plumbers, electricians, painters/decorators, carpenters, locksmiths, hairdressers, beauty salons, dentists, vets, restaurants, cafés, gyms, estate agents, accountants, solicitors, garages, florists, bakeries and photographers.");
		}

		private static string First(Dictionary<string, object> d, params string[] keys)
		{
			foreach (string key in keys)
			{
				string @string = GetString(d, key);
				if (@string.Length > 0)
				{
					return @string;
				}
			}
			return "";
		}

		private static string BuildAddress(Dictionary<string, object> tags, string fallback)
		{
			string @string = GetString(tags, "addr:housenumber");
			string string2 = GetString(tags, "addr:street");
			string text = First(tags, "addr:city", "addr:town", "addr:place");
			string string3 = GetString(tags, "addr:postcode");
			List<string> list = new List<string>();
			string text2 = (@string + " " + string2).Trim();
			if (text2.Length > 0)
			{
				list.Add(text2);
			}
			if (text.Length > 0)
			{
				list.Add(text);
			}
			if (string3.Length > 0)
			{
				list.Add(string3);
			}
			if (list.Count <= 0)
			{
				return fallback;
			}
			return string.Join(", ", list);
		}

		private static Dictionary<string, object> GetDictionary(Dictionary<string, object> d, string key)
		{
			object value;
			if (d == null || !d.TryGetValue(key, out value))
			{
				return null;
			}
			return value as Dictionary<string, object>;
		}

		private static string GetString(Dictionary<string, object> d, string key)
		{
			object value;
			if (d == null || !d.TryGetValue(key, out value) || value == null)
			{
				return "";
			}
			return Convert.ToString(value, CultureInfo.InvariantCulture);
		}

		private static int GetInt(Dictionary<string, object> d, string key)
		{
			int result;
			if (!int.TryParse(GetString(d, key), out result))
			{
				return 0;
			}
			return result;
		}

		private static double GetDouble(Dictionary<string, object> d, string key)
		{
			double result;
			if (!double.TryParse(GetString(d, key), NumberStyles.Any, CultureInfo.InvariantCulture, out result))
			{
				return 0.0;
			}
			return result;
		}

		private static string Csv(object value)
		{
			return "\"" + Convert.ToString(value, CultureInfo.InvariantCulture).Replace("\"", "\"\"") + "\"";
		}

		private static string SafeName(string value)
		{
			char[] value2 = (from c in value.ToLowerInvariant()
				select (!char.IsLetterOrDigit(c)) ? '-' : c).ToArray();
			return new string(value2).Trim('-');
		}
	}
}
